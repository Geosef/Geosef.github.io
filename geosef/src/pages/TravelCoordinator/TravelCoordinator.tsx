import React, { useState, useCallback, useEffect } from 'react';
import Papa from 'papaparse';
import './TravelCoordinator.css';
import resortsCsvData from './north-american-ski-resorts.csv';
// Import our API services
import { getResorts, getTravelers, getFlightRoutes, ApiResort, ApiTraveler } from '../../api/travelService';

interface Traveler {
  name: string;
  homeAirports: string[];
}

interface SkiResort {
  name: string;
  state: string;
  country: string;
  nearestAirport: string;
  airportCode: string;
  driveTime: number;
}

interface FileUploadProps {
  onDataUpload: (data: any[]) => void;
  accept: string;
  id: string;
  label: string;
}

interface TravelAnalysis {
  resort: SkiResort;
  directAccess: string[];  // travelers with direct flights
  oneStop: string[];      // travelers needing one connection
  multiStop: string[];    // travelers needing multiple connections
  averageDriveTime: number;
}

// This will be updated with data from API when available
let DIRECT_ROUTES: Record<string, string[]> = {
  // Major hubs
  'DEN': ['SLC', 'JAC', 'HDN', 'EGE', 'ASE', 'GUC', 'MTJ', 'BZN', 'SEA', 'LAX', 'SFO', 'ORD', 'DFW'],
  'SLC': ['JAC', 'DEN', 'LAX', 'SEA', 'PDX', 'BZN', 'FCA', 'SFO'],
  'SEA': ['DEN', 'SLC', 'PDX', 'BLI', 'GEG', 'FCA', 'BZN', 'SFO', 'LAX'],
  
  // Regional airports with limited connections
  'JAC': ['DEN', 'SLC', 'LAX', 'SFO'],
  'HDN': ['DEN', 'ORD', 'LAX'],
  'EGE': ['DEN', 'ORD', 'LAX'],
  'ASE': ['DEN', 'ORD', 'LAX'],
  'BZN': ['DEN', 'SLC', 'SEA', 'MSP'],
  'FCA': ['SEA', 'SLC', 'MSP'],
  
  // Major origin cities
  'STL': ['DEN', 'ORD', 'DFW', 'LAX'],
  'MSP': ['DEN', 'SLC', 'SEA', 'ORD', 'BZN', 'FCA'],
  'SFO': ['DEN', 'SLC', 'SEA', 'JAC', 'LAX'],
  'BOS': ['DEN', 'ORD', 'JFK', 'LAX'],
  'AUS': ['DEN', 'DFW', 'LAX'],
  'DFW': ['DEN', 'SLC', 'LAX'],
  'ORD': ['DEN', 'SLC', 'JAC', 'HDN', 'EGE', 'ASE'],
  'LAX': ['DEN', 'SLC', 'SEA', 'JAC', 'HDN', 'EGE', 'ASE'],
};

function findMinConnections(origin: string, destination: string): number {
  if (origin === destination) return 0;
  
  // Breadth-first search to find shortest path
  const visited = new Set<string>();
  const queue: [string, number][] = [[origin, 0]];
  visited.add(origin);

  while (queue.length > 0) {
    const [current, connections] = queue.shift()!;
    const directFlights = DIRECT_ROUTES[current] || [];

    if (directFlights.includes(destination)) {
      return connections + 1;
    }

    for (const next of directFlights) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push([next, connections + 1]);
      }
    }
  }

  return 3; // If no route found, assume more than 2 connections needed
}

const FileUpload: React.FC<FileUploadProps> = ({ onDataUpload, accept, id, label }) => {
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      Papa.parse(file, {
        complete: (results) => {
          onDataUpload(results.data);
        },
        header: false,
        skipEmptyLines: true
      });
    }
  }, [onDataUpload]);

  return (
    <div className="file-upload">
      <label htmlFor={id}>{label}</label>
      <input
        type="file"
        id={id}
        accept={accept}
        onChange={handleFileUpload}
      />
    </div>
  );
};

function TravelCoordinator() {
  const [travelers, setTravelers] = useState<Traveler[]>([]);
  const [resorts, setResorts] = useState<SkiResort[]>([]);
  const [error, setError] = useState<string>('');
  const [selectedResort, setSelectedResort] = useState<string | null>(null);
  const [expandedResorts, setExpandedResorts] = useState<string[]>([]);
  const [resortsLoaded, setResortsLoaded] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [useApi, setUseApi] = useState<boolean>(false);

  // Load resort data on component mount
  useEffect(() => {
    if (!resortsLoaded) {
      if (useApi) {
        loadResortsFromApi();
      } else {
        loadResortsData();
      }
    }
  }, [resortsLoaded, useApi]);

  // Try to load flight routes from API
  useEffect(() => {
    const loadFlightRoutes = async () => {
      try {
        const routes = await getFlightRoutes();
        DIRECT_ROUTES = routes;
      } catch (error) {
        console.log('Using fallback flight routes data');
        // Keep using the static routes defined above
      }
    };

    if (useApi) {
      loadFlightRoutes();
    }
  }, [useApi]);

  const loadResortsFromApi = async () => {
    try {
      setIsLoading(true);
      const apiResorts = await getResorts(useApi);
      
      setResorts(apiResorts);
      setResortsLoaded(true);
      setError('');
    } catch (err) {
      setError('Error loading resort data from API. Using local data instead.');
      console.error('Error loading resort data from API:', err);
      // Fallback to local data
      loadResortsData();
    } finally {
      setIsLoading(false);
    }
  };

  const loadResortsData = async () => {
    try {
      setIsLoading(true);
      // Get local JSON data instead of loading CSV
      const localResorts = await getResorts(true);
      setResorts(localResorts);
      setResortsLoaded(true);
      setError('');
    } catch (err) {
      setError('Error loading resort data from local files.');
      console.error('Error loading resort data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const processResortData = (data: any[]) => {
    try {
      const processedResorts = data.map(row => ({
        name: row[0],
        state: row[1],
        country: row[2],
        nearestAirport: row[3],
        airportCode: row[4],
        driveTime: Number.parseInt(row[5], 10)
      }));
      setResorts(processedResorts);
      setError('');
    } catch (err) {
      setError('Error processing resort data. The file may be corrupted.');
      console.error('Error processing resort data:', err);
    }
  };

  const handleTravelerUpload = (data: any[]) => {
    try {
      const processedTravelers = data.map(row => {
        const airports = row.slice(1).filter((airport: string) => airport && airport.trim());
        return {
          name: row[0],
          homeAirports: airports
        };
      });
      setTravelers(processedTravelers);
      setError('');
    } catch (err) {
      setError('Error processing traveler data. Please check the file format.');
    }
  };

  const analyzeTravel = (resort: SkiResort): TravelAnalysis => {
    const analysis: TravelAnalysis = {
      resort,
      directAccess: [],
      oneStop: [],
      multiStop: [],
      averageDriveTime: resort.driveTime
    };

    for (const traveler of travelers) {
      // Find best connection count among traveler's home airports
      let bestConnections = 3; // Default to worst case
      for (const origin of traveler.homeAirports) {
        const connections = findMinConnections(origin, resort.airportCode);
        bestConnections = Math.min(bestConnections, connections);
      }

      // Categorize traveler based on best possible route
      switch (bestConnections) {
        case 1:
          analysis.directAccess.push(traveler.name);
          break;
        case 2:
          analysis.oneStop.push(traveler.name);
          break;
        default:
          analysis.multiStop.push(traveler.name);
          break;
      }
    }

    return analysis;
  };

  const toggleResortExpand = (resortName: string) => {
    setExpandedResorts(prev => 
      prev.includes(resortName) 
        ? prev.filter(name => name !== resortName)
        : [...prev, resortName]
    );
  };

  const renderAnalysis = () => {
    if (!resorts.length || !travelers.length) {
      return <p>Please upload both traveler and resort data to see analysis.</p>;
    }

    return (
      <div className="analysis-grid">
        {resorts.map(resort => {
          const analysis = analyzeTravel(resort);
          const isExpanded = expandedResorts.includes(resort.name);
          
          return (
            <div 
              key={resort.airportCode} 
              className={`resort-row ${isExpanded ? 'expanded' : ''}`}
              onClick={() => toggleResortExpand(resort.name)}
            >
              <div className="resort-row-header">
                <div className="resort-info">
                  <span className="resort-name">{resort.name}</span>
                  <span className="resort-location">
                    {resort.state}, {resort.country} • {resort.airportCode}
                  </span>
                </div>
                
                <div className="analysis-stats">
                  <div className="stat">
                    <span className="stat-label">Direct</span>
                    <span className="stat-value">{analysis.directAccess.length}</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">One Stop</span>
                    <span className="stat-value">{analysis.oneStop.length}</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Multi Stop</span>
                    <span className="stat-value">{analysis.multiStop.length}</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Drive</span>
                    <span className="stat-value">{analysis.averageDriveTime} min</span>
                  </div>
                  <span className="expand-icon">▼</span>
                </div>
              </div>
              
              <div className="detailed-analysis">
                <h4>Detailed Breakdown</h4>
                <div className="connection-groups">
                  <div className="connection-group">
                    <h5>Direct Flights:</h5>
                    <ul>{analysis.directAccess.map(name => <li key={name}>{name}</li>)}</ul>
                  </div>
                  <div className="connection-group">
                    <h5>One Stop:</h5>
                    <ul>{analysis.oneStop.map(name => <li key={name}>{name}</li>)}</ul>
                  </div>
                  <div className="connection-group">
                    <h5>Multiple Stops:</h5>
                    <ul>{analysis.multiStop.map(name => <li key={name}>{name}</li>)}</ul>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Add a function to load travelers from API
  const loadTravelersFromApi = async () => {
    try {
      setIsLoading(true);
      const apiTravelers = await getTravelers();
      
      const processedTravelers: Traveler[] = apiTravelers.map(traveler => ({
        name: traveler.name,
        homeAirports: traveler.homeAirports
      }));
      
      setTravelers(processedTravelers);
      setError('');
    } catch (err) {
      setError('Error loading traveler data from API.');
      console.error('Error loading traveler data from API:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Add a toggle for API/local data
  const toggleDataSource = () => {
    setUseApi(!useApi);
    setResortsLoaded(false); // This will trigger a reload with the new source
  };

  return (
    <div className="travel-coordinator">
      <h1>Ski Trip Travel Coordinator</h1>
      
      {error && <div className="error-message">{error}</div>}
      {isLoading && <div className="loading">Loading data...</div>}
      
      <div className="data-source-toggle">
        <label>
          <input 
            type="checkbox" 
            checked={useApi} 
            onChange={toggleDataSource} 
          />
          Use API data
        </label>
      </div>
      
      <section className="input-section">
        <h2>Upload Data</h2>
        <div className="upload-container">
          <FileUpload
            onDataUpload={handleTravelerUpload}
            accept=".csv"
            id="traveler-upload"
            label="Upload Travelers CSV"
          />
        </div>

        <div className="data-preview">
          <div className="travelers-preview">
            <h3>Travelers ({travelers.length})</h3>
            <ul>
              {travelers.map((traveler, index) => (
                <li key={traveler.name}>
                  {traveler.name} - Airports: {traveler.homeAirports.join(', ')}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="analysis-section">
        <h2>Travel Analysis</h2>
        {renderAnalysis()}
      </section>
    </div>
  );
}

export default TravelCoordinator; 