/**
 * Simple Example
 *
 * A minimal example showing how data flows and enriches through steps.
 */

import { createFlow } from '../index'

// Define what each step produces
type UserInput = { userId: string }
type UserData = { userName: string; email: string }
type Preferences = { theme: 'light' | 'dark'; language: string }
type WelcomeMessage = { message: string }

// Create the flow
const userOnboardingFlow = createFlow<UserInput>({ name: 'User Onboarding' })
  // Step 1: Fetch user data
  .addStep<UserData>({
    name: 'Fetch User',
    execute: async (input) => {
      // input is: { userId: string }
      console.log(`Fetching user ${input.userId}...`)
      return {
        userName: 'Alice',
        email: 'alice@example.com',
      }
    },
  })

  // Step 2: Load preferences
  .addStep<Preferences>({
    name: 'Load Preferences',
    execute: async (input) => {
      // input is: { userId, userName, email }
      console.log(`Loading preferences for ${input.userName}...`)
      return {
        theme: 'dark',
        language: 'en',
      }
    },
  })

  // Step 3: Generate welcome message
  .addStep<WelcomeMessage>({
    name: 'Generate Welcome',
    execute: async (input) => {
      // input is: { userId, userName, email, theme, language }
      console.log(`Generating welcome for ${input.userName} (${input.theme} theme)...`)
      return {
        message: `Welcome back, ${input.userName}! Your ${input.theme} theme is ready.`,
      }
    },
  })

// Run the flow
async function main() {
  const result = await userOnboardingFlow.execute({ userId: 'user-123' })

  if (result.success) {
    // result.data has ALL fields from ALL steps:
    // userId, userName, email, theme, language, message
    console.log('\nFinal data:', result.data)
    console.log('\nWelcome message:', result.data.message)
  }
}

main()
