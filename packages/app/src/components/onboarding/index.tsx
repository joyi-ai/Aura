import { StepProvider } from "./step-provider"
import { StepTheme } from "./step-theme"
import { StepDial } from "./step-dial"

export { OnboardingProvider, useOnboarding } from "./context"

export function Onboarding() {
  return (
    <>
      <StepProvider />
      <StepTheme />
      <StepDial />
    </>
  )
}
