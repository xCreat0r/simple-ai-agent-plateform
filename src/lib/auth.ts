export const GUEST_USER_ID = "00000000-0000-0000-0000-000000000001";

export function getCurrentUser() {
  return { id: GUEST_USER_ID, name: "Guest" };
}
