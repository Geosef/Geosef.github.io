import { useState, useEffect } from 'react';
import './TravelCoordinator.css';
import { getResorts } from '../../api/travelService';
import { SkiResort, Traveler } from './types';
import FilterSection from './components/FilterSection';
import ResortRow from './components/ResortRow';
import TravelerInput from './components/TravelerInput';
import { analyzeTravel } from './utils/analysisUtils';

export default function TravelCoordinator() {
  const [travelers, setTravelers] = useState<Traveler[]>([]);
  const [resorts, setResorts] = useState<SkiResort[]>([]);
  const [filteredResortsList, setFilteredResortsList] = useState<SkiResort[]>([]);
  const [expandedResorts, setExpandedResorts] = useState<string[]>([]);
  const [resortsLoaded, setResortsLoaded] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [useApi, setUseApi] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

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

  // Data source toggle handlers
  const toggleDataSource = () => {
    setUseApi(!useApi);
    setResortsLoaded(false); // This will trigger a reload with the new source
  };

  // Resort expansion handler
  const toggleResortExpand = (resortName: string) => {
    setExpandedResorts(prev => 
      prev.includes(resortName)
        ? prev.filter(name => name !== resortName)
        : [...prev, resortName]
    );
  };

  return (
    <div className="travel-coordinator">
      <h1>Ski Trip Travel Coordinator</h1>
      
      {error && <div className="error-message">{error}</div>}
      {isLoading && <div className="loading">Loading data...</div>}
      
      <div className="data-source-toggle">
        <label className="toggle-switch">
          <input
            type="checkbox"
            checked={useApi}
            onChange={toggleDataSource}
          />
          <span className="toggle-slider"></span>
        </label>
        <span className="toggle-label">
          {useApi ? 'Using API Data' : 'Using Local Data'}
        </span>
      </div>
      
      <TravelerInput 
        onTravelersChanged={setTravelers} 
      />
      
      <section className="analysis-section">
        <h2>Travel Analysis</h2>
        
        {(!resortsLoaded || !travelers.length) ? (
          <p>Please load resort data and add travelers to see analysis.</p>
        ) : (
          <>
            <FilterSection 
              resorts={resorts} 
              onFiltersChanged={setFilteredResortsList} 
            />
            
            <div className="results-counter">
              Showing {filteredResortsList.length} of {resorts.length} resorts
            </div>
            
            <div className="analysis-grid">
              {filteredResortsList.map(resort => (
                <ResortRow 
                  key={resort.id}
                  resort={resort}
                  analysis={analyzeTravel(resort, travelers)}
                  isExpanded={expandedResorts.includes(resort.name)}
                  onToggleExpand={toggleResortExpand}
                />
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
} 