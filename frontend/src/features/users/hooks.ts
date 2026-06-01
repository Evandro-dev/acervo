import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createAccessUser, fetchAccessUsers } from "./api";

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
