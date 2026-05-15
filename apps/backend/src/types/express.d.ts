import { SessionUserDto } from '@car-rental/shared-types';

declare global {
  namespace Express {
    interface Request {
      user?: SessionUserDto;
    }
  }
}
