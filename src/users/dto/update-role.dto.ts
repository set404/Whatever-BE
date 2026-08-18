import { IsEnum } from 'class-validator';
import { GlobalRole } from '../../roles/global-role.enum';

export class UpdateRoleDto {
  @IsEnum(GlobalRole)
  role: GlobalRole;
}
