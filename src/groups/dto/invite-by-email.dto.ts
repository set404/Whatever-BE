import { IsEmail } from 'class-validator';

export class InviteByEmailDto {
  @IsEmail()
  email: string;
}
