export const detections = [
  { region: "C3", type: "Crop Stress", confidence: "91%", temp: "36.2°C", risk: "High", time: "10:25 AM" },
  { region: "D2", type: "Water Stress", confidence: "87%", temp: "37.8°C", risk: "High", time: "10:16 AM" },
  { region: "E4", type: "Temperature Anomaly", confidence: "81%", temp: "36.4°C", risk: "Medium", time: "10:12 AM" },
  { region: "B1", type: "Normal", confidence: "96%", temp: "31.2°C", risk: "Low", time: "10:04 AM" },
];

export const sensors = [
  { name: "RGB Camera", type: "Visual imagery", value: "ONLINE", status: "active" },
  { name: "Thermal Sensor", type: "Temperature mapping", value: "ONLINE", status: "active" },
  { name: "GPS", type: "12 satellites", value: "FIXED", status: "active" },
  { name: "Environment", type: "Humidity / temperature", value: "ONLINE", status: "active" },
];

export const farms = [
  { code: "A-104", name: "North Tomato Field", crop: "Tomato", area: "12.4 acres", health: "82%", risk: "High" },
  { code: "B-207", name: "East Vegetable Block", crop: "Potato", area: "8.7 acres", health: "94%", risk: "Low" },
  { code: "C-311", name: "Research Plot", crop: "Tomato", area: "5.2 acres", health: "76%", risk: "Medium" },
];

export const missionPoints = [
  { id: "C1", x: 18, y: 24, status: "normal" },
  { id: "C2", x: 35, y: 31, status: "monitor" },
  { id: "C3", x: 56, y: 43, status: "high" },
  { id: "C4", x: 73, y: 31, status: "normal" },
  { id: "C5", x: 79, y: 64, status: "monitor" },
];
