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
import { AccountObjectsResponse } from "xrpl";

let ticketQueue: number[] = [];
let createTicketsPromise: Promise<void | TxResponse<TicketCreate>> = null;

// this will be called when client is connected
export async function populateTicketQueue(client: Client) {
  // Get account info
  const responses: AccountObjectsResponse[] = await client.requestAll({
    command: "account_objects",
    account: fundingWallet.address,
    type: "ticket",
    limit: 300,
  });
  // Empty the ticket queue before refilling it
  ticketQueue = [];

  // Populate ticketQueue with existing ticket sequence numbers
  responses.forEach((response) => {
    if (response.result.account_objects) {
      for (let ticketObject of response.result.account_objects) {
        const ticket = ticketObject as Ticket;
        ticketQueue.push(Number(ticket.TicketSequence));
      }
    }
  });
  console.log("Available Tickets:", ticketQueue.length);
}

export async function getTicket(client: Client) {
  // Check Available Tickets ---------------------------------------------------
  if (ticketQueue.length < config.MIN_TICKET_COUNT && !createTicketsPromise) {
    const ticketsToCreate = Math.min(
      140,
      config.MAX_TICKET_COUNT - ticketQueue.length
    );
    console.log(
      `${rTracer.id()} | Creating ${ticketsToCreate} tickets. ${
        ticketQueue.length
      } tickets remaining.`
    );
    let createdTickets = 0;
    createTicketsPromise = client
      .submitAndWait(
        {
          TransactionType: "TicketCreate",
          TicketCount: ticketsToCreate,
          Account: fundingWallet.address,
        },
        {
          wallet: fundingWallet,
        }
      )
      .then((response) => {
        // Populate the ticket queue with newly created tickets
        (response.result.meta as TransactionMetadata).AffectedNodes.forEach(
          (node: any) => {
            if (
              isCreatedNode(node) &&
              node.CreatedNode.LedgerEntryType === "Ticket"
            ) {
              ticketQueue.push(
                (node.CreatedNode.NewFields as Partial<Ticket>).TicketSequence
              );
              createdTickets++;
            }
          }
        );
        console.log(
          `Created ${createdTickets} tickets. Tx hash: ${response.result?.hash}`
        );
        createTicketsPromise = null;
      })
      .catch((error) => {
        console.log(
          `Failed to create tickets. Error: ${JSON.stringify(error)}`
        );
      });
  }

  if (ticketQueue.length === 0) {
    console.log(`${rTracer.id()} | Waiting for tickets to be created.`);
    await createTicketsPromise;
  }

  const ticket = ticketQueue.shift();
  console.log(`${rTracer.id()} | Remaining Tickets: ${ticketQueue.length}`);

  return Promise.resolve(ticket);
}
