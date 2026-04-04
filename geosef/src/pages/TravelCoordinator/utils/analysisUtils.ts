import { SkiResort, Traveler, TravelAnalysis } from '../types';
import { DIRECT_ROUTES } from '../constants';

export function findMinConnections(origin: string, destination: string): number {
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

export function analyzeTravel(resort: SkiResort, travelers: Traveler[]): TravelAnalysis {
  const directAccess: string[] = [];
  const oneStop: string[] = [];
  const multiStop: string[] = [];
  
  // Analyze travel connectivity for each traveler
  travelers.forEach(traveler => {
    traveler.homeAirports.forEach(airport => {
      const connections = findMinConnections(airport, resort.airportCode);
      
      if (connections === 1) {
        directAccess.push(airport);
      } else if (connections === 2) {
        oneStop.push(airport);
      } else {
        multiStop.push(airport);
      }
    });
  });
  
  // Calculate average drive time (same for all travelers)
  const averageDriveTime = resort.driveTime;
  
  return {
    resort,
    directAccess: Array.from(new Set(directAccess)),
    oneStop: Array.from(new Set(oneStop)),
    multiStop: Array.from(new Set(multiStop)),
    averageDriveTime
  };
} 