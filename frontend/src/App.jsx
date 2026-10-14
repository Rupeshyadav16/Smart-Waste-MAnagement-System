import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import "./App.css";

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8002";

const INDIAN_CITIES = [
  "Mumbai",
  "Delhi",
  "Kolkata",
  "Bengaluru",
  "Chennai",
  "Hyderabad",
  "Pune",
  "Ahmedabad",
];

const emptyForm = {
  bin_name: "",
  city: "Mumbai",
  location: "",
  area: "",
  fill_level: 0,
  status: "Empty",
};

const getRequestError = (error, fallback) => {
  const detail = error.response?.data?.detail;
  return detail ? `${fallback}: ${detail}` : fallback;
};

const normalizeBin = (bin) => {
  if (bin.city !== undefined && bin.fill_level !== undefined) {
    return {
      ...bin,
      priority_score:
        (bin.fill_level || 0) +
        (bin.status === "Critical" ? 30 : 0) +
        (bin.status === "Full" ? 15 : 0),
    };
  }

  const fillLevel =
    bin.load_status === "full"
      ? 100
      : Math.max(0, Math.min(100, Math.round((bin.weight || 0) * 2)));

  const status =
    bin.alert || bin.gas_status?.status === "methane_detected"
      ? "Critical"
      : fillLevel >= 80
      ? "Full"
      : fillLevel >= 40
      ? "Half Full"
      : "Empty";

  return {
    id: bin.id,
    bin_name: `Bin ${bin.id}`,
    city: "Sensor Network",
    location: `Node ${bin.id}`,
    area:
      bin.gas_status?.status === "methane_detected"
        ? "Gas Alert Zone"
        : "General Zone",
    fill_level: fillLevel,
    status,
    last_updated: bin.last_updated,
    load_status: bin.load_status,
    gas_status: bin.gas_status,
    weight: bin.weight,
    alert: bin.alert,
    light_indicator: bin.light_indicator,
    buzzer: bin.buzzer,
    priority_score:
      fillLevel +
      (bin.alert || bin.gas_status?.status === "methane_detected" ? 30 : 0),
  };
};

function App() {
  const [bins, setBins] = useState([]);
  const [cityFilter, setCityFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [formData, setFormData] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [simulationMessage, setSimulationMessage] = useState("");
  const [activePage, setActivePage] = useState("Overview");
  const [lastSync, setLastSync] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [analytics, setAnalytics] = useState(null);
  const [analyticsError, setAnalyticsError] = useState("");
  const [apiError, setApiError] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadBins = async () => {
    try {
      setIsRefreshing(true);
      const res = await axios.get(`${API}/bins/`);
      setBins((res.data || []).map(normalizeBin));
      setLastSync(new Date());
      setApiError("");

      try {
        const analyticsResponse = await axios.get(`${API}/analytics/dashboard`);
        setAnalytics(analyticsResponse.data);
        setAnalyticsError("");
      } catch (analyticsLoadError) {
        setAnalyticsError("Analytics are unavailable. Start the updated FastAPI backend to enable them.");
        console.error("Error loading analytics:", analyticsLoadError);
      }
    } catch (error) {
      setApiError(`Cannot connect to the FastAPI server at ${API}. Start the backend, then refresh the data.`);
      console.error("Error loading bins:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadBins();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      loadBins();
    }, 8000);

    return () => clearInterval(interval);
  }, [autoRefresh]);

  const cities = useMemo(() => {
    const uniqueCities = [...new Set(bins.map((bin) => bin.city))];
    return ["All", ...uniqueCities];
  }, [bins]);

  const filteredBins = useMemo(() => {
    let result = [...bins];

    if (cityFilter !== "All") {
      result = result.filter((bin) => bin.city === cityFilter);
    }

    if (statusFilter !== "All") {
      result = result.filter((bin) => bin.status === statusFilter);
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        (bin) =>
          bin.bin_name.toLowerCase().includes(q) ||
          bin.city.toLowerCase().includes(q) ||
          bin.location.toLowerCase().includes(q) ||
          bin.area.toLowerCase().includes(q)
      );
    }

    return result;
  }, [bins, cityFilter, statusFilter, searchTerm]);

  const optimizedRoute = useMemo(() => {
    return [...filteredBins]
      .filter((bin) => bin.fill_level >= 60 || bin.status === "Critical")
      .sort((a, b) => (b.priority_score || b.fill_level) - (a.priority_score || a.fill_level))
      .slice(0, 8);
  }, [filteredBins]);

  const criticalAlerts = useMemo(() => {
    return [...filteredBins]
      .filter((bin) => bin.fill_level >= 80 || bin.status === "Critical")
      .sort((a, b) => (b.priority_score || b.fill_level) - (a.priority_score || a.fill_level));
  }, [filteredBins]);

  const totalBins = filteredBins.length;
  const criticalBins = filteredBins.filter(
    (bin) => bin.fill_level >= 80 || bin.status === "Critical"
  ).length;
  const mediumBins = filteredBins.filter(
    (bin) => bin.fill_level >= 40 && bin.fill_level < 80
  ).length;
  const lowBins = filteredBins.filter((bin) => bin.fill_level < 40).length;

  const coverageCities = useMemo(
    () => new Set(bins.map((bin) => bin.city)).size,
    [bins]
  );

  const citySummary = useMemo(() => {
    const summary = {};

    bins.forEach((bin) => {
      if (!summary[bin.city]) {
        summary[bin.city] = {
          total: 0,
          critical: 0,
          medium: 0,
          low: 0,
          avgFill: 0,
          totalFill: 0,
        };
      }

      summary[bin.city].total += 1;
      summary[bin.city].totalFill += bin.fill_level;

      if (bin.fill_level >= 80 || bin.status === "Critical") {
        summary[bin.city].critical += 1;
      } else if (bin.fill_level >= 40) {
        summary[bin.city].medium += 1;
      } else {
        summary[bin.city].low += 1;
      }
    });

    Object.keys(summary).forEach((city) => {
      summary[city].avgFill = Math.round(
        summary[city].totalFill / summary[city].total
      );
    });

    return Object.entries(summary).sort((a, b) => b[1].critical - a[1].critical);
  }, [bins]);

  const highestRiskCity = citySummary.length > 0 ? citySummary[0] : null;

  const maxDemand = useMemo(() => {
    if (!analytics?.city_collection_demand?.length) return 1;
    return Math.max(...analytics.city_collection_demand.map((item) => item.collection_demand), 1);
  }, [analytics]);

  const totalDistribution = useMemo(() => {
    if (!analytics?.fill_distribution?.length) return 1;
    return analytics.fill_distribution.reduce((sum, item) => sum + item.count, 0);
  }, [analytics]);

  const getStatusFromFill = (fillLevel) => {
    if (fillLevel >= 80) return "Full";
    if (fillLevel >= 40) return "Half Full";
    return "Empty";
  };

  const getStatusClass = (fillLevel, status = "") => {
    if (status === "Critical") return "critical";
    if (fillLevel >= 80) return "critical";
    if (fillLevel >= 40) return "warning";
    return "safe";
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "fill_level") {
      const fill = Number(value);
      setFormData({
        ...formData,
        fill_level: fill,
        status: getStatusFromFill(fill),
      });
      return;
    }

    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const resetForm = () => {
    setFormData(emptyForm);
    setEditingId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFeedback(null);
    setIsSaving(true);

    try {
      const payload = {
        ...formData,
        fill_level: Number(formData.fill_level),
        status: getStatusFromFill(Number(formData.fill_level)),
      };

      if (editingId) {
        await axios.put(`${API}/bins/${editingId}`, payload);
      } else {
        await axios.post(`${API}/bins/`, payload);
      }

      setFeedback({
        type: "success",
        message: editingId
          ? `${payload.bin_name} was updated successfully.`
          : `${payload.bin_name} was added successfully.`,
      });
      resetForm();
      await loadBins();
      setActivePage("Bin Network Status");
    } catch (error) {
      setFeedback({
        type: "error",
        message: getRequestError(error, "Could not save this bin. Check that the FastAPI backend is running"),
      });
      console.error("Error saving bin:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (bin) => {
    setFormData({
      bin_name: bin.bin_name,
      city: bin.city,
      location: bin.location,
      area: bin.area,
      fill_level: bin.fill_level,
      status: bin.status,
    });
    setEditingId(bin.id);
    setActivePage("Control Panel");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id) => {
    const confirmed = window.confirm("Are you sure you want to delete this smart bin?");
    if (!confirmed) return;

    try {
      await axios.delete(`${API}/bins/${id}`);
      setFeedback({ type: "success", message: "The smart bin was deleted." });
      await loadBins();
    } catch (error) {
      setFeedback({
        type: "error",
        message: getRequestError(error, "Could not delete this bin"),
      });
      console.error("Error deleting bin:", error);
    }
  };

  const handleCollected = async (bin) => {
    try {
      await axios.put(`${API}/bins/${bin.id}`, {
        bin_name: bin.bin_name,
        city: bin.city,
        location: bin.location,
        area: bin.area,
        fill_level: 0,
        status: "Empty",
      });
      setFeedback({ type: "success", message: `${bin.bin_name} was marked as collected.` });
      await loadBins();
    } catch (error) {
      setFeedback({
        type: "error",
        message: getRequestError(error, "Could not mark this bin as collected"),
      });
      console.error("Error marking bin as collected:", error);
    }
  };

  const runSimulation = async () => {
    try {
      const res = await axios.post(`${API}/bins/simulate`);
      setSimulationMessage(`${res.data.message} - ${res.data.updated_bins} bins updated`);
      setFeedback({ type: "success", message: "Sensor readings were simulated and analytics were refreshed." });
      await loadBins();
    } catch (error) {
      setFeedback({
        type: "error",
        message: getRequestError(error, "Could not run the sensor simulation"),
      });
      console.error("Error running sensor simulation:", error);
    }
  };

  return (
    <div className="ops-shell">
      <aside className="ops-sidebar">
        <div>
          <div className="ops-brand">
            <div className="ops-logo">SW</div>
            <div>
              <div className="ops-title">Smart Waste</div>
              <div className="ops-subtitle">Operations Center</div>
            </div>
          </div>

          <div className="sidebar-nav">
            {["Overview", "Big Data Analytics", "Control Panel", "Bin Network Status", "Route Optimizer", "Critical Alerts"].map((page) => (
              <button
                key={page}
                className={`nav-btn ${activePage === page ? "active" : ""}`}
                onClick={() => {
                  setActivePage(page);
                  loadBins();
                }}
              >
                {page}
              </button>
            ))}
          </div>

          <div className="sidebar-block">
            <div className="sidebar-label">System Status</div>
            <div className={`status-chip ${apiError ? "offline" : "online"}`}>
              {apiError ? "Backend Offline" : "Backend Online"}
            </div>
            <div className="status-chip active">
              {autoRefresh ? "Auto Refresh On" : "Auto Refresh Off"}
            </div>
          </div>

          <div className="sidebar-block">
            <div className="sidebar-label">Monitoring Region</div>
            <select
              className="sidebar-select"
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
            >
              {cities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </div>

          <div className="sidebar-block">
            <div className="sidebar-label">Filters</div>
            <select
              className="sidebar-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="All">All Status</option>
              <option value="Full">Full</option>
              <option value="Half Full">Half Full</option>
              <option value="Empty">Empty</option>
              <option value="Critical">Critical</option>
            </select>

            <input
              className="sidebar-input"
              type="text"
              placeholder="Search city, bin, location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="sidebar-block">
            <div className="sidebar-label">Controls</div>
            <button className="simulate-btn" onClick={runSimulation}>
              Run Sensor Simulation
            </button>
            <button
              className="secondary-control-btn"
              onClick={() => setAutoRefresh((prev) => !prev)}
            >
              {autoRefresh ? "Disable Auto Refresh" : "Enable Auto Refresh"}
            </button>
            <button
              className="secondary-control-btn"
              onClick={loadBins}
              disabled={isRefreshing}
            >
              {isRefreshing ? "Refreshing..." : "Refresh Dashboard Data"}
            </button>
            {simulationMessage && <p className="simulation-message">{simulationMessage}</p>}
          </div>

          <div className="sidebar-block">
            <div className="sidebar-label">Coverage</div>
            <div className="mini-metric">{coverageCities} Cities</div>
            <div className="mini-metric">{bins.length} Total Bins</div>
            <div className="mini-metric">
              {lastSync ? `Synced: ${lastSync.toLocaleTimeString()}` : "Syncing..."}
            </div>
          </div>
        </div>
      </aside>

      <main className="ops-main">
        {feedback && (
          <div className={`feedback-message ${feedback.type}`} role="status">
            <span>{feedback.message}</span>
            <button type="button" onClick={() => setFeedback(null)} aria-label="Dismiss message">×</button>
          </div>
        )}
        {apiError && <div className="api-error" role="alert">{apiError}</div>}
        {activePage === "Overview" && (
          <>
            <section className="top-banner">
              <div>
                <p className="eyebrow">SMART CITY MONITORING</p>
                <h1>Waste Network Command Center</h1>
                <p className="banner-text">
                  Monitor fill levels, detect collection risks, simulate sensor changes,
                  and manage smart bins across multiple cities.
                </p>
              </div>

              <div className="banner-panel">
                <div className="banner-kpi">
                  <span>Selected Region</span>
                  <strong>{cityFilter}</strong>
                </div>
                <div className="banner-kpi">
                  <span>Highest Risk City</span>
                  <strong>{highestRiskCity ? highestRiskCity[0] : "N/A"}</strong>
                </div>
              </div>
            </section>

            <section className="metric-grid">
              <div className="metric-card">
                <span className="metric-label">Monitored Bins</span>
                <h3>{totalBins}</h3>
              </div>
              <div className="metric-card critical-card">
                <span className="metric-label">Critical Fill</span>
                <h3>{criticalBins}</h3>
              </div>
              <div className="metric-card warning-card">
                <span className="metric-label">Medium Load</span>
                <h3>{mediumBins}</h3>
              </div>
              <div className="metric-card safe-card">
                <span className="metric-label">Low Fill</span>
                <h3>{lowBins}</h3>
              </div>
            </section>

            <section className="overview-two-col">
              <section className="ops-panel">
                <div className="panel-header">
                  <h2>City Overview</h2>
                  <span className="panel-badge">{coverageCities} Cities</span>
                </div>

                <div className="city-grid">
                  {citySummary.map(([city, stats]) => (
                    <div className="city-card" key={city}>
                      <div className="city-card-header">
                        <h3>{city}</h3>
                        <span>{stats.total} bins</span>
                      </div>

                      <div className="city-stats">
                        <div className="city-stat critical-text">Critical: {stats.critical}</div>
                        <div className="city-stat warning-text">Medium: {stats.medium}</div>
                        <div className="city-stat safe-text">Low: {stats.low}</div>
                        <div className="city-stat neutral-text">Avg Fill: {stats.avgFill}%</div>
                      </div>

                      <button
                        className="city-view-btn"
                        onClick={() => {
                          setCityFilter(city);
                          setActivePage("Bin Network Status");
                        }}
                      >
                        View Network
                      </button>
                    </div>
                  ))}
                </div>
              </section>

              <section className="ops-panel">
                <div className="panel-header">
                  <h2>Top Urgent Bins</h2>
                  <span className="panel-badge">Priority Queue</span>
                </div>

                <div className="urgent-list">
                  {optimizedRoute.slice(0, 5).map((bin, index) => (
                    <div className="urgent-item" key={bin.id}>
                      <div className="urgent-rank">{index + 1}</div>
                      <div className="urgent-info">
                        <strong>{bin.bin_name}</strong>
                        <p>
                          {bin.city} • {bin.location}
                        </p>
                      </div>
                      <div className="urgent-score">{bin.priority_score || bin.fill_level}</div>
                    </div>
                  ))}
                </div>
              </section>
            </section>
          </>
        )}

        {activePage === "Big Data Analytics" && (
          <>
            <section className="top-banner analytics-banner">
              <div>
                <p className="eyebrow">IOT + BIG DATA INSIGHTS</p>
                <h1>Waste Intelligence Dashboard</h1>
                <p className="banner-text">
                  Cleaned sensor telemetry is analysed to reveal waste-generation patterns,
                  bin fill levels, and collection demand across Indian cities.
                </p>
              </div>
              <div className="pipeline-chip-list" aria-label="Data pipeline">
                <span>IoT Sensors</span>
                <span>FastAPI</span>
                <span>HDFS / Spark</span>
                <span>Dashboard</span>
              </div>
            </section>

            {analyticsError && <p className="analytics-error">{analyticsError}</p>}

            {analytics ? (
              <>
                <section className="metric-grid analytics-metric-grid">
                  <div className="metric-card">
                    <span className="metric-label">Historic Readings</span>
                    <h3>{analytics.kpis.historic_readings.toLocaleString()}</h3>
                  </div>
                  <div className="metric-card warning-card">
                    <span className="metric-label">Average Fill Level</span>
                    <h3>{analytics.kpis.current_average_fill}%</h3>
                  </div>
                  <div className="metric-card critical-card">
                    <span className="metric-label">Critical Bins Now</span>
                    <h3>{analytics.kpis.current_critical_bins}</h3>
                  </div>
                  <div className="metric-card safe-card">
                    <span className="metric-label">Clean Data Rows</span>
                    <h3>{analytics.data_quality.accepted_rows.toLocaleString()}</h3>
                  </div>
                </section>

                <section className="analytics-layout">
                  <section className="ops-panel">
                    <div className="panel-header">
                      <h2>Waste Generation Pattern</h2>
                      <span className="panel-badge">Last 14 Days</span>
                    </div>
                    <p className="chart-caption">Average recorded fill level by day from cleaned IoT telemetry.</p>
                    <div className="trend-chart">
                      {analytics.daily_fill_trend.map((point) => (
                        <div className="trend-column" key={point.date}>
                          <span className="trend-value">{point.average_fill}%</span>
                          <div className="trend-track">
                            <div className="trend-bar" style={{ height: `${point.average_fill}%` }}></div>
                          </div>
                          <span className="trend-label">{point.date.slice(5)}</span>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="ops-panel">
                    <div className="panel-header">
                      <h2>Bin Fill-Level Analysis</h2>
                      <span className="panel-badge">All Readings</span>
                    </div>
                    <div className="distribution-list">
                      {analytics.fill_distribution.map((item) => (
                        <div className="distribution-item" key={item.label}>
                          <div className="distribution-heading">
                            <span>{item.label}</span>
                            <strong>{item.count.toLocaleString()}</strong>
                          </div>
                          <div className="distribution-track">
                            <div
                              className="distribution-bar"
                              style={{ width: `${(item.count / totalDistribution) * 100}%` }}
                            ></div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="quality-note">
                      Data cleaning accepted {analytics.data_quality.accepted_rows.toLocaleString()} of {analytics.data_quality.raw_rows.toLocaleString()} readings; invalid rows are excluded.
                    </p>
                  </section>
                </section>

                <section className="ops-panel">
                  <div className="panel-header">
                    <h2>Collection Demand Analysis</h2>
                    <span className="panel-badge">Live City Priority</span>
                  </div>
                  <p className="chart-caption">Demand combines each city's current average fill level and number of critical bins.</p>
                  <div className="demand-list">
                    {analytics.city_collection_demand.map((item) => (
                      <div className="demand-row" key={item.city}>
                        <div className="demand-city">
                          <strong>{item.city}</strong>
                          <span>{item.total_bins} bins · {item.critical_bins} critical · {item.average_fill}% avg</span>
                        </div>
                        <div className="demand-track">
                          <div
                            className="demand-bar"
                            style={{ width: `${(item.collection_demand / maxDemand) * 100}%` }}
                          ></div>
                        </div>
                        <strong className="demand-score">{item.collection_demand}</strong>
                      </div>
                    ))}
                  </div>
                </section>
              </>
            ) : (
              <section className="ops-panel"><p className="empty-state">Loading cleaned sensor analytics...</p></section>
            )}
          </>
        )}

        {activePage === "Control Panel" && (
          <section className="ops-panel">
            <div className="panel-header">
              <h2>{editingId ? "Edit Smart Bin" : "Add New Smart Bin"}</h2>
              <span className="panel-badge">{editingId ? "Editing" : "Create"}</span>
            </div>

            <form className="control-form" onSubmit={handleSubmit}>
              <input type="text" name="bin_name" placeholder="Bin Name" value={formData.bin_name} onChange={handleChange} required />
              <select name="city" value={formData.city} onChange={handleChange}>
                {INDIAN_CITIES.map((city) => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
              <input type="text" name="location" placeholder="Location" value={formData.location} onChange={handleChange} required />
              <input type="text" name="area" placeholder="Area" value={formData.area} onChange={handleChange} required />
              <input type="number" name="fill_level" min="0" max="100" placeholder="Fill Level" value={formData.fill_level} onChange={handleChange} required />
              <input type="text" name="status" value={formData.status} readOnly className="readonly-input" />

              <div className="form-actions">
                <button type="submit" className="primary-btn" disabled={isSaving}>
                  {isSaving ? "Saving..." : editingId ? "Update Bin" : "Add Bin"}
                </button>
                {editingId && (
                  <button type="button" className="secondary-btn" onClick={resetForm}>
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </section>
        )}

        {activePage === "Bin Network Status" && (
          <section className="ops-panel table-panel">
            <div className="panel-header">
              <h2>Bin Network Status</h2>
              <span className="panel-badge">{filteredBins.length} Visible</span>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Bin</th>
                    <th>City</th>
                    <th>Location</th>
                    <th>Area</th>
                    <th>Fill</th>
                    <th>Status</th>
                    <th>Priority</th>
                    <th>Updated</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBins.length > 0 ? (
                    filteredBins.map((bin) => (
                      <tr key={bin.id}>
                        <td>{bin.id}</td>
                        <td>{bin.bin_name}</td>
                        <td>{bin.city}</td>
                        <td>{bin.location}</td>
                        <td>{bin.area}</td>
                        <td>
                          <div className="fill-cell">
                            <div className="fill-track">
                              <div
                                className={`fill-bar ${getStatusClass(bin.fill_level, bin.status)}`}
                                style={{ width: `${bin.fill_level}%` }}
                              ></div>
                            </div>
                            <span>{bin.fill_level}%</span>
                          </div>
                        </td>
                        <td>
                          <span className={`status ${getStatusClass(bin.fill_level, bin.status)}`}>
                            {bin.status}
                          </span>
                        </td>
                        <td>
                          <span className="priority-pill">{bin.priority_score || bin.fill_level}</span>
                        </td>
                        <td>{new Date(bin.last_updated).toLocaleString()}</td>
                        <td>
                          <div className="action-buttons">
                            <button className="collect-btn" onClick={() => handleCollected(bin)}>Collected</button>
                            <button className="edit-btn" onClick={() => handleEdit(bin)}>Edit</button>
                            <button className="delete-btn" onClick={() => handleDelete(bin.id)}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="10">No bins found for current filters.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activePage === "Route Optimizer" && (
          <>
            <section className="ops-panel">
              <div className="panel-header">
                <h2>Collection Route Optimizer</h2>
                <span className="panel-badge">{optimizedRoute.length} Priority Stops</span>
              </div>

              <p className="route-intro">
                These bins should be collected first based on fill level and urgency score.
              </p>

              {optimizedRoute.length > 0 ? (
                <div className="route-list">
                  {optimizedRoute.map((bin, index) => (
                    <div className="route-card" key={bin.id}>
                      <div className="route-rank">{index + 1}</div>

                      <div className="route-info">
                        <h3>{bin.bin_name}</h3>
                        <p>
                          {bin.location}, {bin.city} • {bin.area}
                        </p>
                      </div>

                      <div className="route-priority">
                        <span>Priority</span>
                        <strong>{bin.priority_score || bin.fill_level}</strong>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="empty-state">No high-priority bins for this region right now.</p>
              )}
            </section>
          </>
        )}

{activePage === "Critical Alerts" && (
          <section className="ops-panel">
            <div className="panel-header">
              <h2>Critical Alerts Center</h2>
              <span className="panel-badge">{criticalAlerts.length} Active</span>
            </div>

            {criticalAlerts.length > 0 ? (
              <div className="alert-list">
                {criticalAlerts.map((bin) => (
                  <div className="alert-item" key={bin.id}>
                    <div>
                      <strong>{bin.bin_name}</strong>
                      <p>
                        {bin.location}, {bin.city} • {bin.area}
                      </p>
                    </div>
                    <div className="alert-fill">{bin.fill_level}%</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-state">No critical alerts for this region.</p>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

export default App;

                   
