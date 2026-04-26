import { render, screen } from "@testing-library/react";

jest.mock("axios", () => {
  const axiosMock = {
    post: () => Promise.resolve({ data: { docs: [] } }),
    get: () => Promise.resolve({ data: {} }),
    put: () => Promise.resolve({ data: { ok: true } }),
    delete: () => Promise.resolve({ data: { ok: true } }),
  };

  return {
    __esModule: true,
    default: axiosMock,
    ...axiosMock,
  };
});

import App from "./App";

test("renders the profile selection screen", async () => {
  window.localStorage.clear();
  render(<App />);
  expect(
    screen.getByRole("heading", { name: /pro pitch baseball/i })
  ).toBeInTheDocument();
  expect(
    await screen.findByText(/no players were found in the central user database/i)
  ).toBeInTheDocument();
});
