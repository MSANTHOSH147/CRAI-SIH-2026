export const missionConfig = {
  missionCode: "CRAI-M001",
  farmCode: "FARM-A104",
  farmName: "Farm A-104",
  fieldName: "Tomato Field",
  crop: "Tomato",
  areaAcres: 12.4,

  drone: {
    id: "CRAI-DRONE-01",
    model: "Agricultural Scout",
    altitude: 30,
    speed: 5.2,
    battery: 76,
    satellites: 12,
  },

  grid: {
    rows: 4,
    columns: 6,
  },
};

export const scanRoute = [
  "A1",
  "A2",
  "A3",
  "A4",
  "A5",
  "A6",

  "B6",
  "B5",
  "B4",
  "B3",
  "B2",
  "B1",

  "C1",
  "C2",
  "C3",
  "C4",
  "C5",
  "C6",

  "D6",
  "D5",
  "D4",
  "D3",
  "D2",
  "D1",
];

export const initialGridState = scanRoute.reduce(
  (grid, cell) => {
    grid[cell] = {
      status: "unscanned",
      risk: null,
      disease: null,
      confidence: null,
      temperature: null,
      humidity: null,
    };

    return grid;
  },
  {}
);
