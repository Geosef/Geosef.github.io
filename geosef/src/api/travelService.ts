import apiClient from './config';

// Import local JSON data files
import page1Data from '../pages/TravelCoordinator/page1.json';
import page2Data from '../pages/TravelCoordinator/page2.json';
import page3Data from '../pages/TravelCoordinator/page3.json';
import page4Data from '../pages/TravelCoordinator/page4.json';
import page5Data from '../pages/TravelCoordinator/page5.json';
import page6Data from '../pages/TravelCoordinator/page6.json';
import page7Data from '../pages/TravelCoordinator/page7.json';
import page8Data from '../pages/TravelCoordinator/page8.json';

// API response types
interface ApiResortResponse {
  page: number;
  per_page: number;
  pre_page: number | null;
  next_page: number | null;
  total: number;
  total_pages: number;
  data: ApiResortData[];
}

interface ApiResortData {
  slug: string;
  name: string;
  country: string;
  region?: string;
  location: {
    latitude: number;
    longitude: number;
  };
  url: string;
}

// Our application types
export interface ApiResort {
  id: string;
  name: string;
  state: string;
  country: string;
  nearestAirport: string;
  airportCode: string;
  driveTime: number;
  location?: {
    latitude: number;
    longitude: number;
  };
}

export interface ApiTraveler {
  id: string;
  name: string;
  homeAirports: string[];
}

// Helper function to load local JSON data
export const getLocalResortData = (): ApiResortData[] => {
  // Combine all pages of data
  const allData = [
    ...page1Data.data,
    ...page2Data.data,
    ...page3Data.data,
    ...page4Data.data,
    ...page5Data.data,
    ...page6Data.data,
    ...page7Data.data,
    ...page8Data.data
  ];
  
  // Filter to only include resorts with region data (mainly North America)
  return allData.filter(resort => resort.region);
};

// Map of region codes to nearest airports
const REGION_TO_AIRPORT: Record<string, { airport: string, code: string, driveTime: number }> = {
  // US regions
  'CO': { airport: 'Denver International', code: 'DEN', driveTime: 90 },
  'UT': { airport: 'Salt Lake City International', code: 'SLC', driveTime: 45 },
  'CA': { airport: 'Reno-Tahoe International', code: 'RNO', driveTime: 60 },
  'VT': { airport: 'Burlington International', code: 'BTV', driveTime: 60 },
  'WA': { airport: 'Seattle-Tacoma International', code: 'SEA', driveTime: 90 },
  'MT': { airport: 'Bozeman Yellowstone International', code: 'BZN', driveTime: 60 },
  'ID': { airport: 'Friedman Memorial', code: 'SUN', driveTime: 30 },
  'WY': { airport: 'Jackson Hole', code: 'JAC', driveTime: 30 },
  'NM': { airport: 'Albuquerque International', code: 'ABQ', driveTime: 120 },
  'NH': { airport: 'Manchester-Boston Regional', code: 'MHT', driveTime: 90 },
  'ME': { airport: 'Portland International Jetport', code: 'PWM', driveTime: 120 },
  'NY': { airport: 'Albany International', code: 'ALB', driveTime: 90 },
  'PA': { airport: 'Philadelphia International', code: 'PHL', driveTime: 120 },
  'MI': { airport: 'Gerald R. Ford International', code: 'GRR', driveTime: 60 },
  'AZ': { airport: 'Phoenix Sky Harbor', code: 'PHX', driveTime: 150 },
  'NV': { airport: 'Reno-Tahoe International', code: 'RNO', driveTime: 60 },
  'AK': { airport: 'Ted Stevens Anchorage International', code: 'ANC', driveTime: 60 },
  'NC': { airport: 'Asheville Regional', code: 'AVL', driveTime: 60 },
  'MA': { airport: 'Boston Logan International', code: 'BOS', driveTime: 120 },
  'WI': { airport: 'Dane County Regional', code: 'MSN', driveTime: 60 },
  'WV': { airport: 'Yeager Airport', code: 'CRW', driveTime: 90 },
  'OR': { airport: 'Portland International', code: 'PDX', driveTime: 90 },
  
  // Canadian regions
  'BC': { airport: 'Vancouver International', code: 'YVR', driveTime: 120 },
  'AB': { airport: 'Calgary International', code: 'YYC', driveTime: 120 },
  'ON': { airport: 'Toronto Pearson International', code: 'YYZ', driveTime: 120 },
  'QC': { airport: 'Montréal-Pierre Elliott Trudeau International', code: 'YUL', driveTime: 120 },
  'QB': { airport: 'Montréal-Pierre Elliott Trudeau International', code: 'YUL', driveTime: 120 },
  
  // Australia/NZ regions
  'NSW': { airport: 'Sydney Airport', code: 'SYD', driveTime: 180 },
  'VIC': { airport: 'Melbourne Airport', code: 'MEL', driveTime: 180 },
  'OTA': { airport: 'Queenstown Airport', code: 'ZQN', driveTime: 30 },
  
  // Default
  'DEFAULT': { airport: 'Nearest Regional Airport', code: 'XXX', driveTime: 90 }
};

// Country code to full name
const COUNTRY_NAMES: Record<string, string> = {
  'US': 'United States',
  'CA': 'Canada',
  'AU': 'Australia',
  'NZ': 'New Zealand',
  'CH': 'Switzerland',
  'FR': 'France',
  'IT': 'Italy',
  'AT': 'Austria',
  'ES': 'Spain',
  'JP': 'Japan',
  'IL': 'Italy',  // Looks like a data error in the API
  // Add more as needed
};

// Helper function to transform resort data to our application format
const transformResortData = (resort: ApiResortData): ApiResort => {
  // Get airport info based on region, or use default
  const airportInfo = resort.region && REGION_TO_AIRPORT[resort.region] 
    ? REGION_TO_AIRPORT[resort.region] 
    : REGION_TO_AIRPORT['DEFAULT'];
  
  return {
    id: resort.slug,
    name: resort.name,
    state: resort.region || 'Unknown',
    country: COUNTRY_NAMES[resort.country] || resort.country,
    nearestAirport: airportInfo.airport,
    airportCode: airportInfo.code,
    driveTime: airportInfo.driveTime,
    location: resort.location
  };
};

// Resort APIs
export const getResorts = async (useLocalData = false): Promise<ApiResort[]> => {
  try {
    if (useLocalData) {
      const localData = getLocalResortData();
      return localData.map(transformResortData);
    }
    
    const response = await apiClient.get('/resorts');
    const resortResponse = response.data as ApiResortResponse;
    
    // Map API data to our application format
    return resortResponse.data.map(transformResortData);
  } catch (error) {
    console.error('Error fetching resorts:', error);
    throw error;
  }
};

// Traveler APIs
export const getTravelers = async (): Promise<ApiTraveler[]> => {
  try {
    const response = await apiClient.get('/travelers');
    return response.data;
  } catch (error) {
    console.error('Error fetching travelers:', error);
    throw error;
  }
};

export const createTraveler = async (traveler: Omit<ApiTraveler, 'id'>): Promise<ApiTraveler> => {
  try {
    const response = await apiClient.post('/travelers', traveler);
    return response.data;
  } catch (error) {
    console.error('Error creating traveler:', error);
    throw error;
  }
};

// Flight data
export const getFlightRoutes = async (): Promise<Record<string, string[]>> => {
  try {
    const response = await apiClient.get('/flight-routes');
    return response.data;
  } catch (error) {
    console.error('Error fetching flight routes:', error);
    throw error;
  }
}; 