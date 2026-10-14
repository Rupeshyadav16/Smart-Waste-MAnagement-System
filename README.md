<<<<<<< HEAD
# Smart Waste Management: IoT and Big Data Analytics

A smart-city waste-management project for Indian cities. It combines a live operations dashboard with a scalable Hadoop and PySpark batch-analysis workflow.

## System architecture

```text
IoT / Sensor Data
        |
        v
Smart Waste Bins
        |
        v
FastAPI Backend ---------------> Live Operations Dashboard (React)
        |                                  |
        v                                  v
Cleaned sensor telemetry              Charts and priority alerts
        |
        v
Large Waste Dataset (CSV)
        |
        v
Hadoop HDFS
        |
        v
Apache Spark / PySpark
        |
        v
Data Cleaning and Processing
        |
        +--> Waste-generation patterns
        +--> Bin fill-level analysis
        +--> Collection-demand analysis
```

## What the project does

- Simulates IoT fill-level readings for 48 bins in Mumbai, Delhi, Kolkata, Bengaluru, Chennai, Hyderabad, Pune, and Ahmedabad.
- Ingests and cleans each simulated sensor snapshot in FastAPI.
- Displays live bin status, critical alerts, a collection-priority queue, and a Big Data Analytics page.
- Produces a large raw CSV dataset for Hadoop HDFS.
- Runs a PySpark job that validates, de-duplicates, classifies, aggregates, and writes analytical outputs.

## Dashboard analytics

Open **Big Data Analytics** in the sidebar to see:

- **Waste generation pattern:** average fill level across the last 14 days.
- **Bin fill-level analysis:** historical readings divided into low, medium, and critical bands.
- **Collection demand analysis:** each city's live priority score, based on current fill level and critical-bin count.

The local FastAPI service prepares 11,520 cleaned historical readings (30 days, one reading every three hours for each bin). Clicking **Run Sensor Simulation** adds the latest simulated IoT snapshot to that history.

## Project structure

```text
smart-waste-management-main/
|- frontend/                              # React + Vite dashboard
|  `- src/
|     |- App.jsx                          # Dashboard, API calls, analytics charts
|     `- App.css                          # Dashboard and chart styles
|- backend/                               # FastAPI service
|  `- app/
|     |- main.py                          # API setup and telemetry initialization
|     |- routes/
|     |  |- bins.py                       # Bin CRUD and sensor simulation
|     |  `- analytics.py                  # Dashboard analytics endpoint
|     `- services/
|        `- analytics.py                  # Sensor cleaning and aggregate analysis
|- data_pipeline/                         # Large-data batch workflow
|  |- generate_waste_dataset.py           # Creates a raw CSV (250,000 rows by default)
|  |- hadoop/upload_to_hdfs.ps1           # Uploads the CSV to HDFS
|  |- spark/process_waste_data.py         # Cleans and analyses data with PySpark
|  `- requirements-bigdata.txt            # PySpark dependency
|- data/raw/                              # Generated local data (not committed)
`- README.md
```

## API endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/bins/` | List live smart bins |
| `POST` | `/bins/` | Add a bin |
| `PUT` | `/bins/{id}` | Update a bin or mark it collected |
| `DELETE` | `/bins/{id}` | Delete a bin |
| `POST` | `/bins/simulate` | Simulate a new IoT sensor snapshot |
| `GET` | `/analytics/dashboard` | Get cleaned telemetry aggregates for the charts |

## Run the live dashboard locally

Open two PowerShell terminals at the repository root.

### 1. Start FastAPI

```powershell
cd backend
& "C:\Users\ASUS\AppData\Local\Programs\Python\Python310\python.exe" -m venv .venv
& .\.venv\Scripts\python.exe -m pip install -r requirements.txt
& .\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8002
```

The API is now running at `http://127.0.0.1:8002`; interactive Swagger documentation is at `http://127.0.0.1:8002/docs`.

### 2. Start React

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```

Open the Vite URL printed in the terminal, normally `http://localhost:5173`.

## Run the Hadoop and Spark batch workflow

This is optional for the live dashboard, but it is the scalable path for a real large dataset. It requires Java, Hadoop/HDFS, and Apache Spark to already be installed and configured on your machine or cluster.

### 1. Generate a large raw sensor dataset

From the project root:

```powershell
& "C:\Users\ASUS\AppData\Local\Programs\Python\Python310\python.exe" data_pipeline\generate_waste_dataset.py --rows 250000
```

This creates `data/raw/waste_sensor_readings.csv`. Some deliberately invalid readings are included so the cleaning stage has real work to perform.

### 2. Upload it to HDFS

```powershell
.\data_pipeline\hadoop\upload_to_hdfs.ps1
```

The file is uploaded to `/smart-waste/raw/waste_sensor_readings.csv`.

### 3. Submit the PySpark analysis job

```powershell
spark-submit data_pipeline\spark\process_waste_data.py --input hdfs:///smart-waste/raw/waste_sensor_readings.csv --output hdfs:///smart-waste/processed
```

The job writes:

- partitioned Parquet clean readings: `/smart-waste/processed/cleaned_readings`
- city collection demand: `/smart-waste/processed/city_collection_demand`
- daily waste-fill pattern: `/smart-waste/processed/daily_fill_pattern`
- low/medium/critical distribution: `/smart-waste/processed/fill_distribution`

## Data-cleaning rules

Both the FastAPI and PySpark paths apply the same core rules:

1. Require a valid timestamp, bin/device ID, city, and fill level.
2. Keep fill levels only in the 0-100 range.
3. Normalize valid live sensor values to the 0-100 range.
4. Drop duplicate Spark records with the same event time and device ID.
5. Categorize clean readings as Low, Medium, or Critical.

## Important demo limitation

The live FastAPI telemetry history is held in memory, so it resets when the backend restarts. The HDFS + Spark workflow is the persistent, scalable analytics path; in a production deployment, its processed outputs would be stored in a data warehouse or served through an analytics API.
=======
# Smart-Waste-MAnagement-System
>>>>>>> d4de50ed5bb67278c86b14aa24e427e8ef9c54c2
>>>>>>>
>>>>>>> Contribution
>>>>>>> Rupesh Yadav
