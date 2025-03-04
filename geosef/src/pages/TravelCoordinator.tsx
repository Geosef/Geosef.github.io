import React, { useState, useCallback } from 'react';
import Papa from 'papaparse';
import './TravelCoordinator.css';

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

  const handleResortUpload = (data: any[]) => {
    try {
      const processedResorts = data.map(row => ({
        name: row[0],
        state: row[1],
        country: row[2],
        nearestAirport: row[3],
        airportCode: row[4],
        driveTime: parseInt(row[5], 10)
      }));
      setResorts(processedResorts);
      setError('');
    } catch (err) {
      setError('Error processing resort data. Please check the file format.');
    }
  };

  // This is a placeholder until we get real flight data
  const analyzeTravel = (resort: SkiResort): TravelAnalysis => {
    const analysis: TravelAnalysis = {
      resort,
      directAccess: [],
      oneStop: [],
      multiStop: [],
      averageDriveTime: resort.driveTime
    };

    travelers.forEach(traveler => {
      // For now, we'll randomly assign travelers to connection categories
      // This will be replaced with real flight data logic
      const randomCategory = Math.floor(Math.random() * 3);
      switch (randomCategory) {
        case 0:
          analysis.directAccess.push(traveler.name);
          break;
        case 1:
          analysis.oneStop.push(traveler.name);
          break;
        case 2:
          analysis.multiStop.push(traveler.name);
          break;
      }
    });

    return analysis;
  };

  const renderAnalysis = () => {
    if (!resorts.length || !travelers.length) {
      return <p>Please upload both traveler and resort data to see analysis.</p>;
    }

    return (
      <div className="analysis-grid">
        {resorts.map(resort => {
          const analysis = analyzeTravel(resort);
          return (
            <div 
              key={resort.airportCode} 
              className="resort-analysis-card"
              onClick={() => setSelectedResort(resort.name)}
            >
              <h3>{resort.name}</h3>
              <div className="analysis-stats">
                <div className="stat">
                  <span className="stat-label">Direct Access:</span>
                  <span className="stat-value">{analysis.directAccess.length}</span>
                </div>
                <div className="stat">
                  <span className="stat-label">One Stop:</span>
                  <span className="stat-value">{analysis.oneStop.length}</span>
                </div>
                <div className="stat">
                  <span className="stat-label">Multi Stop:</span>
                  <span className="stat-value">{analysis.multiStop.length}</span>
                </div>
                <div className="stat">
                  <span className="stat-label">Drive Time:</span>
                  <span className="stat-value">{analysis.averageDriveTime} min</span>
                </div>
              </div>
              {selectedResort === resort.name && (
                <div className="detailed-analysis">
                  <h4>Detailed Breakdown</h4>
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
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="travel-coordinator">
      <h1>Ski Trip Travel Coordinator</h1>
      
      {error && <div className="error-message">{error}</div>}
      
      <section className="input-section">
        <h2>Upload Data</h2>
        <div className="upload-container">
          <FileUpload
            onDataUpload={handleTravelerUpload}
            accept=".csv"
            id="traveler-upload"
            label="Upload Travelers CSV"
          />
          <FileUpload
            onDataUpload={handleResortUpload}
            accept=".csv"
            id="resort-upload"
            label="Upload Resorts CSV"
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

          <div className="resorts-preview">
            <h3>Resorts ({resorts.length})</h3>
            <ul>
              {resorts.map((resort, index) => (
                <li key={`${resort.name}-${resort.airportCode}`}>
                  {resort.name} ({resort.state}, {resort.country}) - 
                  Airport: {resort.airportCode} ({resort.driveTime} min drive)
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="resort-section">
        <h2>Ski Resorts</h2>
        {/* Resort list and selection will go here */}
      </section>

      <section className="analysis-section">
        <h2>Travel Analysis</h2>
        {renderAnalysis()}
      </section>
    </div>
  );
}

export default TravelCoordinator; 