import { useQuery } from '@tanstack/react-query'
import { getUserData } from '@/server/user'
import { useUser } from '@/context/UserContext'

export function useUserData() {
  const { user } = useUser()

  return useQuery({
    queryKey: ['userData', user?.id],
    queryFn: () => getUserData(),
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 10, 
    gcTime: 1000 * 60 * 30, 
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  })
}
