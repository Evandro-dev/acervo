import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UpdateAccessAccountPayload } from "@/types/acervo";
import { createAccessUser, fetchAccessUsers, setAccessUserActive, updateAccessUser } from "./api";

const accessUserKeys = {
  root: ["access-users"] as const,
};

export function useAccessUsersQuery(enabled = true) {
  return useQuery({
    enabled,
    queryKey: accessUserKeys.root,
    queryFn: fetchAccessUsers,
  });
}

export function useCreateAccessUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createAccessUser,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: accessUserKeys.root });
    },
  });
}

export function useUpdateAccessUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, payload }: { userId: string; payload: UpdateAccessAccountPayload }) =>
      updateAccessUser(userId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: accessUserKeys.root });
    },
  });
}

export function useSetAccessUserActiveMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      setAccessUserActive(userId, isActive),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: accessUserKeys.root });
    },
  });
}
