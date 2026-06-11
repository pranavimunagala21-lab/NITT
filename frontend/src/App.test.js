import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

test("renders the login page first", () => {
  render(<App />);

  expect(screen.getByRole("heading", { name: /login/i })).toBeInTheDocument();
  expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
});

test("switches from login to signup", async () => {
  render(<App />);

  await userEvent.click(screen.getByRole("button", { name: /need an account/i }));

  expect(
    screen.getByRole("heading", { name: /create account/i })
  ).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /sign up/i })).toBeInTheDocument();
});
