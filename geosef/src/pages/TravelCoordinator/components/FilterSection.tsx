import { useState, useEffect } from 'react';
import type { SkiResort } from '../types';
import { PASS_RESORTS } from '../constants';

interface FilterSectionProps {
  resorts: SkiResort[];
  onFiltersChanged: (filteredResorts: SkiResort[]) => void;
}

export default function FilterSection({ resorts, onFiltersChanged }: FilterSectionProps) {
  const [selectedPasses, setSelectedPasses] = useState<string[]>([]);
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [selectedStates, setSelectedStates] = useState<string[]>([]);

  // Helper functions
  const getUniqueValues = (resorts: SkiResort[], key: keyof SkiResort): string[] => {
    const values = resorts.map(resort => resort[key] as string);
    return Array.from(new Set(values)).sort();
  };

  const getAllPasses = (): string[] => {
    return Object.keys(PASS_RESORTS);
  };

  // Toggle functions for filters
  const togglePassFilter = (pass: string) => {
    setSelectedPasses(prev => 
      prev.includes(pass) 
        ? prev.filter(p => p !== pass) 
        : [...prev, pass]
    );
  };

  const toggleCountryFilter = (country: string) => {
    const newSelectedCountries = selectedCountries.includes(country)
      ? selectedCountries.filter(c => c !== country)
      : [...selectedCountries, country];
    
    setSelectedCountries(newSelectedCountries);
    
    // Clear state selections when country selection changes
    setSelectedStates([]);
  };

  const toggleStateFilter = (state: string) => {
    setSelectedStates(prev => 
      prev.includes(state) 
        ? prev.filter(s => s !== state) 
        : [...prev, state]
    );
  };

  // Apply filters function
  const getFilteredResorts = (): SkiResort[] => {
    return resorts.filter(resort => {
      // Pass filter
      const resortPasses = Object.entries(PASS_RESORTS)
        .filter(([_, resorts]) => resorts.includes(resort.id))
        .map(([passName, _]) => passName);
        
      const passMatch = selectedPasses.length === 0 || 
        resortPasses.some(pass => selectedPasses.includes(pass));
      
      // Country filter
      const countryMatch = selectedCountries.length === 0 || 
        selectedCountries.includes(resort.country);
      
      // State filter
      const stateMatch = selectedStates.length === 0 || 
        selectedStates.includes(resort.state);
      
      return passMatch && countryMatch && stateMatch;
    });
  };

  // Update filtered resorts when filters change
  useEffect(() => {
    onFiltersChanged(getFilteredResorts());
  }, [selectedPasses, selectedCountries, selectedStates, resorts]);

  return (
    <div className="filter-section">
      <div className="filter-group">
        <h4>Filter by Pass</h4>
        <div className="filter-options">
          {getAllPasses().map(pass => (
            <label key={pass} className="filter-option">
              <input
                type="checkbox"
                checked={selectedPasses.includes(pass)}
                onChange={() => togglePassFilter(pass)}
              />
              <span className={`filter-label pass-${pass}`}>{pass}</span>
            </label>
          ))}
        </div>
      </div>
      
      <div className="filter-group">
        <h4>Filter by Country</h4>
        <div className="filter-options">
          {getUniqueValues(resorts, 'country').map(country => (
            <label key={country} className="filter-option">
              <input
                type="checkbox"
                checked={selectedCountries.includes(country)}
                onChange={() => toggleCountryFilter(country)}
              />
              <span className="filter-label">{country}</span>
            </label>
          ))}
        </div>
      </div>
      
      {selectedCountries.length > 0 && (
        <div className="filter-group">
          <h4>Filter by State/Region</h4>
          <div className="filter-options">
            {getUniqueValues(resorts.filter(resort => 
              selectedCountries.includes(resort.country)
            ), 'state').map(state => (
              <label key={state} className="filter-option">
                <input
                  type="checkbox"
                  checked={selectedStates.includes(state)}
                  onChange={() => toggleStateFilter(state)}
                />
                <span className="filter-label">{state}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
} 