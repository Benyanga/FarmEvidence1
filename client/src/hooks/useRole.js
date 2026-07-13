import { useRoleContext } from '../context/RoleContext';

/** Returns the current user's role from Clerk publicMetadata (synced to Mongo). */
export default function useRole() {
  const { role, dbUser, loading } = useRoleContext();
  return { role, dbUser, loading };
}
