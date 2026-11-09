import { Router } from 'express';
import { getDiscover, postImportFranchise } from '../controllers/discover.controller.js';

export const discoverRouter = Router();

discoverRouter.get('/', getDiscover);
discoverRouter.post('/import', postImportFranchise);