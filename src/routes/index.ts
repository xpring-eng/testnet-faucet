import { Router } from 'express'
import accounts from './accounts';
import info from './info';
import status from './status';

const router = Router()

router.post('accounts', accounts)
router.post('info', info)
router.post('status', status)

export {
  router
}
