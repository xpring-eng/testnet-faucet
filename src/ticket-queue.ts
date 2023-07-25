import {
  Client,
  isCreatedNode,
  TicketCreate,
  TransactionMetadata,
  TxResponse,
} from "xrpl";
import { fundingWallet } from "./wallet";
import { Ticket } from "xrpl/dist/npm/models/ledger";
import { config } from "./config";
import rTracer from "cls-rtracer";

let ticketQueue: number[] = [];
let createTicketsPromise: Promise<void | TxResponse<TicketCreate>>;

async function populateTicketQueue(client: Client) {
  // Get account info
  const response = await client.request({
    command: "account_objects",
    account: fundingWallet.address,
    type: "ticket",
  });
  console.log("Available Tickets:", response.result.account_objects);

  // Populate ticketQueue with existing ticket sequence numbers
  for (let ticketObject of response.result.account_objects) {
    const ticket = ticketObject as Ticket; // Treat the AccountObject as a Ticket
    ticketQueue.push(Number(ticket.TicketSequence));
  }
}

// TODO: Populate the ticket queue on disconnect or every once in a while to account for tickets used by other systems
export async function getTicket(client: Client) {
  // Check Available Tickets ---------------------------------------------------
  await populateTicketQueue(client);
  if (ticketQueue.length < config.MIN_TICKET_COUNT && !createTicketsPromise) {
    const ticketsToCreate = Math.min(
      140,
      config.MAX_TICKET_COUNT - ticketQueue.length
    );
    console.log(
      `Creating ${ticketsToCreate} tickets. ${ticketQueue.length} tickets remaining.`
    );
    createTicketsPromise = client
      .submitAndWait(
        {
          TransactionType: "TicketCreate",
          TicketCount: Math.min(
            140,
            config.MAX_TICKET_COUNT - ticketQueue.length
          ),
          Account: fundingWallet.address,
        },
        {
          wallet: fundingWallet,
        }
      )
      .then((response) => {
        let ticketsCreated = 0;
        // Populate the ticket queue with newly created tickets
        (response.result.meta as TransactionMetadata).AffectedNodes.forEach(
          (node: any) => {
            if (
              isCreatedNode(node) &&
              node.CreatedNode.LedgerEntryType === "Ticket"
            ) {
              ticketsCreated++;
              ticketQueue.push(
                (node.CreatedNode.NewFields as Partial<Ticket>).TicketSequence
              );
            }
          }
        );
        console.log(`Created tickets. Tx: ${response.result.hash}`);
        createTicketsPromise = null;
      })
      .catch((response) => {
        console.log(`Failed to create tickets. Tx: ${response.result.hash}`);
      });
  }

  if (ticketQueue.length === 0) {
    console.log(`${rTracer.id()} | Waiting for tickets to be created.`);
    await createTicketsPromise;
    return ticketQueue.shift();
  }

  return Promise.resolve(ticketQueue.shift());
}
