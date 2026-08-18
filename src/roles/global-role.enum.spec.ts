import { GlobalRole, satisfiesRole } from './global-role.enum';

describe('satisfiesRole', () => {
  it('superadmin satisfies every requirement', () => {
    expect(satisfiesRole(GlobalRole.Superadmin, GlobalRole.Superadmin)).toBe(
      true,
    );
    expect(satisfiesRole(GlobalRole.Superadmin, GlobalRole.Admin)).toBe(true);
    expect(satisfiesRole(GlobalRole.Superadmin, GlobalRole.Member)).toBe(true);
  });

  it('admin satisfies admin and member, not superadmin', () => {
    expect(satisfiesRole(GlobalRole.Admin, GlobalRole.Admin)).toBe(true);
    expect(satisfiesRole(GlobalRole.Admin, GlobalRole.Member)).toBe(true);
    expect(satisfiesRole(GlobalRole.Admin, GlobalRole.Superadmin)).toBe(false);
  });

  it('member only satisfies member', () => {
    expect(satisfiesRole(GlobalRole.Member, GlobalRole.Member)).toBe(true);
    expect(satisfiesRole(GlobalRole.Member, GlobalRole.Admin)).toBe(false);
    expect(satisfiesRole(GlobalRole.Member, GlobalRole.Superadmin)).toBe(false);
  });
});
