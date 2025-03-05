// Option 1: Use fetch API directly
const apiClient = {
  baseURL: process.env.REACT_APP_API_URL || '',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': process.env.REACT_APP_API_KEY || '',
    'x-api-host': process.env.REACT_APP_API_HOST || '',
  },

  async get(url: string) {
    const response = await fetch(`${this.baseURL}${url}`, {
      method: 'GET',
      headers: this.headers,
    });
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }
    
    return { data: await response.json() };
  },

  async post(url: string, data: any) {
    const response = await fetch(`${this.baseURL}${url}`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }
    
    return { data: await response.json() };
  }
};

export default apiClient; 