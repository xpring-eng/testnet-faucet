import { Client } from 'xrpl';
import { config } from './config';

const client = new Client(config.RIPPLED_URI);

client.on('error', (errorCode, errorMessage) => {
  console.log('Client error: ' + errorCode + ': ' + errorMessage)
})

client.on('connected', () => {
  console.log('Client connected')
})

client.on('disconnected', (code) => {
  // code - [close code](https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent) sent by the server
  // will be 1000 if this was normal closure
  console.log('Client disconnected, code:', code)
})

export function connect(): Promise<Client> {
  if(!client.isConnected()) {
    return client.connect().then(() => client)
  }

  return Promise.resolve(client)
}
