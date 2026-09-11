const API_BASE = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000").replace(/\/$/,"");

async function request(path, options={}){
  const res=await fetch(`${API_BASE}${path}`,{
    ...options,
    headers:{...(options.body && !(options.body instanceof FormData)?{"Content-Type":"application/json"}:{}),...(options.headers||{})}
  });
  if(!res.ok){
    let msg=`CRAI API error: ${res.status} ${res.statusText}`;
    try{const d=await res.json(); if(d?.detail) msg=typeof d.detail==="string"?d.detail:JSON.stringify(d.detail)}catch{}
    throw new Error(msg);
  }
  return res.json();
}

export const getHealth=()=>request("/api/health");
export const getAIStatus=()=>request("/api/ai/status");

export async function analyzeFieldImage({file,zoneId="A1",farmId=1,crop="Tomato",growthStage="Vegetative"}){
  const fd=new FormData();
  fd.append("file",file);
  fd.append("zone_id",zoneId);
  fd.append("farm_id",String(farmId));
  fd.append("crop",crop);
  fd.append("growth_stage",growthStage);
  return request("/api/analysis/image",{method:"POST",body:fd});
}

export async function createSensorRequest({farmId=1,zoneId="A1",deviceId="CRAI-ESP32-01",source="ESP32",requestedEvidence="FRESH_SENSOR",reason="ENVIRONMENT",priority="HIGH"}){
  return request("/api/field-sensors/requests",{
    method:"POST",
    body:JSON.stringify({
      farm_id:farmId,zone_id:zoneId,device_id:deviceId,source,
      requested_evidence:requestedEvidence,reason,priority
    })
  });
}

export const getSensorReadings=()=>request("/api/field-sensors/readings");

export async function postSensorReading(data){
  return request("/api/field-sensors/readings",{method:"POST",body:JSON.stringify(data)});
}

export const getPendingSensorRequests=()=>request("/api/field-sensors/requests/pending");
