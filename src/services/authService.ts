import { prisma } from '@/lib/prisma'

export async function getAllPasswordRecords() {
  return prisma.authPassword.findMany({
    select: { role: true, passwordHash: true },
  })
}

export async function updatePassword(role: string, hashedPassword: string) {
  await prisma.authPassword.update({
    where: { role },
    data: { passwordHash: hashedPassword },
  })
}
