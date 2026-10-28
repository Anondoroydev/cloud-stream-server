import { Router } from 'express';
import * as controller from '../controllers/apiController';

export const apiRouter = Router();

apiRouter.get('/health', controller.health);
apiRouter.get('/repository', controller.repository);
apiRouter.get('/providers', controller.providers);
apiRouter.get('/catalog', controller.catalog);
apiRouter.get('/search', controller.search);
apiRouter.get('/movies/:id', controller.details);
apiRouter.get('/movies/:id/streams', controller.streams);
