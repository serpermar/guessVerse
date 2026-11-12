import { Router } from 'express';
import { getDiscover, postImportFranchise, getSuperheroDebug } from '../controllers/discover.controller.js';

export const discoverRouter = Router();

discoverRouter.get('/', getDiscover);
discoverRouter.post('/import', postImportFranchise);
discoverRouter.get('/debug/superhero', getSuperheroDebug);