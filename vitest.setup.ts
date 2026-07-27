import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("dns/promises", () => ({
  lookup: vi.fn().mockResolvedValue([{ address: "203.0.113.1" }]),
}));
