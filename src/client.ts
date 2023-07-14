import { Client } from 'xrpl';

const rippledUri = process.env['RIPPLED_URI']

let instance: Client

export function connect(): Promise<Client> {
  if(!!!instance) {
    instance = new Client(rippledUri);
  }

  if(!instance.isConnected()) {
    return instance.connect().then(() => instance)
  }

  return Promise.resolve(instance)
}
