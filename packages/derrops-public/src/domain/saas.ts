/**
 * Type to represent a SAAS company, i.e. Stripe, Twilio, SendGrid, etc.
 */
export type SAAS = {
  id: string // unique identifier for the SAAS company
  saasId: string // name of the SAAS company
}

/**
 * Type to represent an API of a SAAS company
 */
export type SAASAPI = {
  saasId: string // name of the SAAS company
  name: string // name of the API
  description: string // description of the API
  url: string
  apiKey: string
  apiSecret: string
  apiToken: string
  apiUrl: string
  apiVersion: string
  apiMethod: string
  apiHeaders: Record<string, string>
}
