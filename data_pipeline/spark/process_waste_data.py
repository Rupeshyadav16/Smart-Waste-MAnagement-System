"""Clean smart-waste readings in HDFS and write Spark analytics outputs.

Example:
spark-submit data_pipeline/spark/process_waste_data.py \
  --input hdfs:///smart-waste/raw/waste_sensor_readings.csv \
  --output hdfs:///smart-waste/processed
"""

import argparse

from pyspark.sql import SparkSession
from pyspark.sql import functions as F
from pyspark.sql.types import DoubleType, StringType, StructField, StructType


SCHEMA = StructType(
    [
        StructField("timestamp", StringType(), True),
        StructField("device_id", StringType(), True),
        StructField("city", StringType(), True),
        StructField("location", StringType(), True),
        StructField("fill_level", DoubleType(), True),
        StructField("temperature_c", DoubleType(), True),
        StructField("battery_percent", DoubleType(), True),
        StructField("gas_ppm", DoubleType(), True),
        StructField("source", StringType(), True),
    ]
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Clean and analyse smart-waste IoT data.")
    parser.add_argument("--input", required=True, help="Raw CSV path in HDFS.")
    parser.add_argument("--output", required=True, help="HDFS directory for Parquet/CSV outputs.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    spark = SparkSession.builder.appName("SmartWasteAnalytics").getOrCreate()

    raw = spark.read.option("header", True).schema(SCHEMA).csv(args.input)
    cleaned = (
        raw.withColumn("event_time", F.to_timestamp("timestamp"))
        .filter(F.col("event_time").isNotNull())
        .filter(F.col("device_id").isNotNull() & F.trim("city").isNotNull())
        .filter(F.col("fill_level").between(0, 100))
        .dropDuplicates(["event_time", "device_id"])
        .withColumn("event_date", F.to_date("event_time"))
        .withColumn("event_hour", F.hour("event_time"))
        .withColumn(
            "fill_band",
            F.when(F.col("fill_level") >= 80, "Critical")
            .when(F.col("fill_level") >= 40, "Medium")
            .otherwise("Low"),
        )
    )

    cleaned.write.mode("overwrite").partitionBy("city", "event_date").parquet(
        f"{args.output}/cleaned_readings"
    )

    city_demand = (
        cleaned.groupBy("city")
        .agg(
            F.round(F.avg("fill_level"), 1).alias("average_fill"),
            F.sum(F.when(F.col("fill_level") >= 80, 1).otherwise(0)).alias("critical_readings"),
            F.count("*").alias("reading_count"),
        )
        .withColumn(
            "collection_demand",
            F.round(F.col("average_fill") * 0.75 + F.col("critical_readings") * 0.02, 1),
        )
        .orderBy(F.desc("collection_demand"))
    )
    daily_pattern = (
        cleaned.groupBy("event_date")
        .agg(
            F.round(F.avg("fill_level"), 1).alias("average_fill"),
            F.round(F.avg(F.when(F.col("fill_level") >= 80, 1).otherwise(0)) * 100, 1).alias(
                "critical_rate"
            ),
        )
        .orderBy("event_date")
    )
    fill_distribution = cleaned.groupBy("fill_band").count()

    city_demand.coalesce(1).write.mode("overwrite").option("header", True).csv(
        f"{args.output}/city_collection_demand"
    )
    daily_pattern.coalesce(1).write.mode("overwrite").option("header", True).csv(
        f"{args.output}/daily_fill_pattern"
    )
    fill_distribution.coalesce(1).write.mode("overwrite").option("header", True).csv(
        f"{args.output}/fill_distribution"
    )

    print("Spark analytics written to", args.output)
    spark.stop()


if __name__ == "__main__":
    main()
