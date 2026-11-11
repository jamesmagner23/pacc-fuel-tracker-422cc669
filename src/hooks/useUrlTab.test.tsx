import { render, fireEvent, screen, cleanup } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { MemoryRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { useUrlTab } from "./useUrlTab";
afterEach(cleanup);
function Fixture({ path = false }: { path?: boolean }) {
  const [tab, change] = useUrlTab(["overview", "dockets"], "overview", path ? "/admin" : undefined);
  const navigate = useNavigate();
  const location = useLocation();
  return <><output data-testid="state">{tab}:{location.pathname}{location.search}</output><button onClick={() => change("dockets")}>Dockets</button><button onClick={() => navigate(-1)}>Back</button></>;
}
it("pushes tab changes and restores the prior tab on Back", () => {
  render(<MemoryRouter initialEntries={["/finance?demo=true&tab=overview"]}><Fixture /></MemoryRouter>);
  fireEvent.click(screen.getByText("Dockets"));
  expect(screen.getByTestId("state").textContent).toBe("dockets:/finance?demo=true&tab=dockets");
  fireEvent.click(screen.getByText("Back"));
  expect(screen.getByTestId("state").textContent).toBe("overview:/finance?demo=true&tab=overview");
});
it("uses admin path segments and preserves other parameters", () => {
  render(<MemoryRouter initialEntries={["/admin/overview?demo=true"]}><Routes><Route path="/admin/:tab" element={<Fixture path />} /></Routes></MemoryRouter>);
  fireEvent.click(screen.getByText("Dockets"));
  expect(screen.getByTestId("state").textContent).toBe("dockets:/admin/dockets?demo=true");
});