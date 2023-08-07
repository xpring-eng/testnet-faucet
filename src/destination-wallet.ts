import { classicAddressToXAddress, isValidClassicAddress, xAddressToClassicAddress } from 'ripple-address-codec';
import { Account } from './types';

export function getDestinationAccount(address?: string): Account {
  if(!isValidClassicAddress(address)) {
    throw Error('Invalid destination')
  }

  let xAddress
  let classicAddress
  let tag

  if (address.startsWith('T')) {
    const t = xAddressToClassicAddress(address)
    xAddress = address
    classicAddress = t.classicAddress
    tag = t.tag
  } else {
    xAddress = classicAddressToXAddress(address, false, true)
    classicAddress = address
  }

  return {
    xAddress,
    classicAddress,
    address: classicAddress,
    tag
  }
}
