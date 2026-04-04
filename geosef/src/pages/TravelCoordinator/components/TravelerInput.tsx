import { useState } from 'react';
import type { Traveler } from '../types';

interface TravelerInputProps {
  onTravelersChanged: (travelers: Traveler[]) => void;
}

export default function TravelerInput({ onTravelersChanged }: TravelerInputProps) {
  const [travelers, setTravelers] = useState<Traveler[]>([]);
  const [newTravelerName, setNewTravelerName] = useState('');
  const [newTravelerAirports, setNewTravelerAirports] = useState('');

  const addTraveler = () => {
    if (newTravelerName && newTravelerAirports) {
      const airportCodes = newTravelerAirports
        .split(',')
        .map(code => code.trim().toUpperCase())
        .filter(code => code.length > 0);
      
      if (airportCodes.length > 0) {
        const newTraveler: Traveler = {
          name: newTravelerName,
          homeAirports: airportCodes
        };
        
        const updatedTravelers = [...travelers, newTraveler];
        setTravelers(updatedTravelers);
        onTravelersChanged(updatedTravelers);
        
        // Reset input fields
        setNewTravelerName('');
        setNewTravelerAirports('');
      }
    }
  };

  const removeTraveler = (index: number) => {
    const updatedTravelers = travelers.filter((_, i) => i !== index);
    setTravelers(updatedTravelers);
    onTravelersChanged(updatedTravelers);
  };

  return (
    <div className="traveler-input-section">
      <h2>Travelers</h2>
      
      <div className="add-traveler-form">
        <div className="form-group">
          <label htmlFor="travelerName">Name:</label>
          <input
            type="text"
            id="travelerName"
            value={newTravelerName}
            onChange={(e) => setNewTravelerName(e.target.value)}
            placeholder="e.g. John"
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="travelerAirports">Home Airports:</label>
          <input
            type="text"
            id="travelerAirports"
            value={newTravelerAirports}
            onChange={(e) => setNewTravelerAirports(e.target.value)}
            placeholder="e.g. DEN, ORD (comma separated)"
          />
        </div>
        
        <button 
          onClick={addTraveler}
          disabled={!newTravelerName || !newTravelerAirports}
        >
          Add Traveler
        </button>
      </div>
      
      {travelers.length > 0 ? (
        <div className="travelers-list">
          <h3>Added Travelers:</h3>
          <ul>
            {travelers.map((traveler, index) => (
              <li key={index} className="traveler-item">
                <div className="traveler-info">
                  <span className="traveler-name">{traveler.name}</span>
                  <span className="traveler-airports">
                    {traveler.homeAirports.join(', ')}
                  </span>
                </div>
                <button 
                  onClick={() => removeTraveler(index)}
                  className="remove-traveler-btn"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p>No travelers added yet. Add travelers to see analysis.</p>
      )}
    </div>
  );
} 