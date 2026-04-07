export interface Traveler {
  name: string;
  homeAirports: string[];
}

export interface SkiResort {
  name: string;
  state: string;
  country: string;
  nearestAirport: string;
  airportCode: string;
  driveTime: number;
  id: string;
}

export interface TravelAnalysis {
  resort: SkiResort;
  directAccess: string[];
  oneStop: string[];
  multiStop: string[];
  averageDriveTime: number;
} 