import type { SkiResort, TravelAnalysis } from '../types';
import { PASS_RESORTS } from '../constants';

interface ResortRowProps {
  resort: SkiResort;
  analysis: TravelAnalysis;
  isExpanded: boolean;
  onToggleExpand: (resortName: string) => void;
}

export default function ResortRow({ resort, analysis, isExpanded, onToggleExpand }: ResortRowProps) {
  // Get pass information
  const getResortPasses = (resortId: string): string[] => {
    return Object.entries(PASS_RESORTS)
      .filter(([_, resorts]) => resorts.includes(resortId))
      .map(([passName, _]) => passName);
  };

  return (
    <div 
      className={`resort-row ${isExpanded ? 'expanded' : ''}`}
      onClick={() => onToggleExpand(resort.name)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onToggleExpand(resort.name);
        }
      }}
      tabIndex={0}
      role="button"
      aria-expanded={isExpanded}
    >
      <div className="resort-row-header">
        <div className="resort-info">
          <span className="resort-name">{resort.name}</span>
          <span className="resort-location">
            {resort.state}, {resort.country} • {resort.airportCode}
          </span>
          <div className="resort-passes">
            {getResortPasses(resort.id).map(pass => (
              <span key={pass} className={`pass-tag ${pass.toLowerCase()}`}>
                {pass}
              </span>
            ))}
          </div>
        </div>
        
        <div className="analysis-stats">
          <div className="stat">
            <span className="stat-value">
              {analysis.directAccess.length}
            </span>
            <span className="stat-label">Direct</span>
          </div>
          <div className="stat">
            <span className="stat-value">
              {analysis.oneStop.length}
            </span>
            <span className="stat-label">1-Stop</span>
          </div>
          <div className="stat">
            <span className="stat-value">
              {analysis.multiStop.length}
            </span>
            <span className="stat-label">2+ Stops</span>
          </div>
          <div className="stat">
            <span className="stat-value">
              {analysis.averageDriveTime}
            </span>
            <span className="stat-label">Drive (min)</span>
          </div>
          <span className="expand-icon">↓</span>
        </div>
      </div>
      
      <div className="detailed-analysis" style={{ maxHeight: isExpanded ? '500px' : '0px' }}>
        <div className="connection-details">
          {analysis.directAccess.length > 0 && (
            <div className="connection-group">
              <h5>Direct Flights</h5>
              <ul>
                {analysis.directAccess.map(airport => (
                  <li key={airport}>{airport}</li>
                ))}
              </ul>
            </div>
          )}
          
          {analysis.oneStop.length > 0 && (
            <div className="connection-group">
              <h5>One Stop</h5>
              <ul>
                {analysis.oneStop.map(airport => (
                  <li key={airport}>{airport}</li>
                ))}
              </ul>
            </div>
          )}
          
          {analysis.multiStop.length > 0 && (
            <div className="connection-group">
              <h5>Multiple Stops</h5>
              <ul>
                {analysis.multiStop.map(airport => (
                  <li key={airport}>{airport}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 