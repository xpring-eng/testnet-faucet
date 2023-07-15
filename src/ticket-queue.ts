import { Client, isCreatedNode, TicketCreate, TransactionMetadata, TxResponse } from 'xrpl';
import { fundingWallet } from './wallet';
import { Ticket } from 'xrpl/dist/npm/models/ledger';
import { config } from './config';
import rTracer from 'cls-rtracer';

const ticketQueue: number[] = []
let createTicketsPromise: Promise<void | TxResponse<TicketCreate>>;

// TODO: Populate the ticket queue on disconnect or every once in a while to account for tickets used by other systems
export async function getTicket(client: Client) {
  if(ticketQueue.length < config.MIN_TICKET_COUNT && !createTicketsPromise) {
    const ticketsToCreate = Math.min(140, config.MAX_TICKET_COUNT - ticketQueue.length);
    console.log(`Creating ${ticketsToCreate} tickets. ${ticketQueue.length} tickets remaining.`)
    createTicketsPromise = client.submitAndWait(
      {
        TransactionType: 'TicketCreate',
        TicketCount: Math.min(140, config.MAX_TICKET_COUNT - ticketQueue.length),
        Account: fundingWallet.address
      },
      {
        wallet: fundingWallet
      }
    ).then((response) => {
      let ticketsCreated = 0;
      // Populate the ticket queue with newly created tickets
      (response.result.meta as TransactionMetadata).AffectedNodes.forEach((node: any) => {
        if(isCreatedNode(node) && node.CreatedNode.LedgerEntryType === 'Ticket'){
          ticketsCreated++;
          ticketQueue.push((node.CreatedNode.NewFields as Partial<Ticket>).TicketSequence)
        }
      })
      console.log(`Created tickets. Tx: ${response.result.hash}`);
      createTicketsPromise = null
    }).catch((response) => {
      console.log(`Failed to create tickets. Tx: ${response.result.hash}`);
    })
  }

  if(ticketQueue.length === 0){
    console.log(`${rTracer.id()} | Waiting for tickets to be created.`)
    await createTicketsPromise
    return ticketQueue.shift()
  }

  return Promise.resolve(ticketQueue.shift())
}
