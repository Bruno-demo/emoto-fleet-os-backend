'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserPlus, Check, X, AlertCircle } from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import { z } from 'zod';

const pendingUserSchema = z.array(
  z.object({
    id: z.string(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    createdAt: z.string(),
    fleet: z.object({
      name: z.string(),
      plan: z.string(),
    }),
  })
);

export default function PendingSetupsPage() {
  const queryClient = useQueryClient();

  const { data: users, isLoading } = useQuery({
    queryKey: ['hq', 'pending-users'],
    queryFn: () => apiFetch('/hq/users/pending', {}, { schema: pendingUserSchema }),
  });

  const activateMutation = useMutation({
    mutationFn: (userId: string) => apiFetch(`/hq/users/${userId}/activate`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hq', 'pending-users'] });
      queryClient.invalidateQueries({ queryKey: ['hq', 'stats'] });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Pending Setups</h1>
        <p className="mt-1 text-sm text-zinc-400">Review and activate customer accounts after hardware installation.</p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#18181b] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-white/10 bg-white/5 text-zinc-400">
              <tr>
                <th className="px-6 py-4 font-medium">Fleet Name</th>
                <th className="px-6 py-4 font-medium">Contact</th>
                <th className="px-6 py-4 font-medium">Plan</th>
                <th className="px-6 py-4 font-medium">Registered</th>
                <th className="px-6 py-4 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-zinc-500">
                    Loading pending setups...
                  </td>
                </tr>
              ) : users?.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/5 text-zinc-400">
                      <Check size={20} />
                    </div>
                    <p className="text-zinc-300 font-medium">All caught up!</p>
                    <p className="text-sm text-zinc-500 mt-1">There are no pending hardware installations.</p>
                  </td>
                </tr>
              ) : (
                users?.map((user) => (
                  <tr key={user.id} className="transition-colors hover:bg-white/5">
                    <td className="px-6 py-4 font-medium text-white">{user.fleet.name}</td>
                    <td className="px-6 py-4 text-zinc-300">
                      {user.email && <div>{user.email}</div>}
                      {user.phone && <div className="text-xs text-zinc-500">{user.phone}</div>}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-medium text-zinc-300">
                        {user.fleet.plan}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-zinc-400">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => activateMutation.mutate(user.id)}
                        disabled={activateMutation.isPending}
                        className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-all hover:brightness-110 disabled:opacity-50"
                      >
                        <Check size={16} />
                        Activate Account
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
