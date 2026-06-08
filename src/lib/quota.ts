export interface Plan {
  name: string;
  dailyRequests: number;
  knowledgeStorageMB: number;
  maxAgents: number;
  maxTools: number;
}

const freePlan: Plan = {
  name: "free",
  dailyRequests: 200,
  knowledgeStorageMB: 50,
  maxAgents: 20,
  maxTools: 10,
};

export function getPlan(_userId: string): Plan {
  return freePlan;
}

export async function checkQuota(_userId: string): Promise<{ allowed: boolean; reason?: string }> {
  return { allowed: true };
}
