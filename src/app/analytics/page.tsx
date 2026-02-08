"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Bar,
  BarChart,
  Line,
  LineChart,
  Pie,
  PieChart,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts"
import { ArrowLeft, Users, CalendarCheck, TrendingUp } from "lucide-react"
import { toast } from "sonner"

interface AnalyticsData {
  kpi: {
    totalGuests: number
    totalReservations: number
    avgGuestsPerReservation: number
  }
  dailyTraffic: { date: string; guests: number }[]
  peakHours: { hour: number; guests: number }[]
  partySizeDistribution: { category: string; count: number }[]
}

const dailyTrafficConfig = {
  guests: {
    label: "Гостей",
    color: "hsl(142, 76%, 36%)",
  },
} satisfies ChartConfig

const peakHoursConfig = {
  guests: {
    label: "Гостей",
    color: "hsl(221, 83%, 53%)",
  },
} satisfies ChartConfig

const PIE_COLORS = [
  "hsl(142, 76%, 36%)",
  "hsl(221, 83%, 53%)",
  "hsl(47, 96%, 53%)",
]

const partySizeConfig = {
  couples: {
    label: "Пары/одиночки (1-2)",
    color: PIE_COLORS[0],
  },
  small: {
    label: "Малые группы (3-5)",
    color: PIE_COLORS[1],
  },
  large: {
    label: "Большие компании (6+)",
    color: PIE_COLORS[2],
  },
} satisfies ChartConfig

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00")
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })
}

function formatHourLabel(hour: number): string {
  return `${hour.toString().padStart(2, "0")}:00`
}

export default function AnalyticsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === "loading") return
    if (!session) {
      router.push("/login")
    }
  }, [session, status, router])

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch("/api/analytics")
      if (response.ok) {
        setData(await response.json())
      } else {
        toast.error("Не удалось загрузить данные аналитики")
      }
    } catch {
      toast.error("Не удалось загрузить данные аналитики")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (session) {
      fetchData()
    }
  }, [session, fetchData])

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Загрузка...</div>
      </div>
    )
  }

  if (!session || !data) return null

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Button
            onClick={() => router.push("/reservations")}
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:bg-gray-500 bg-transparent"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Назад к расписанию
          </Button>
          <h1 className="text-xl font-semibold">Аналитика</h1>
          <div className="w-[140px]" /> {/* spacer */}
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-900/50 rounded-lg">
                  <Users className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-400">Всего гостей (30д)</p>
                  <p className="text-2xl font-bold text-white">
                    {data.kpi.totalGuests}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-900/50 rounded-lg">
                  <CalendarCheck className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-400">Резерваций (30д)</p>
                  <p className="text-2xl font-bold text-white">
                    {data.kpi.totalReservations}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-900/50 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-400">Ср. гостей / рез. (30д)</p>
                  <p className="text-2xl font-bold text-white">
                    {data.kpi.avgGuestsPerReservation}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Daily Traffic Chart */}
        <Card className="bg-gray-800 border-gray-700 mb-8">
          <CardHeader>
            <CardTitle className="text-white">Трафик гостей по дням</CardTitle>
            <CardDescription className="text-gray-400">
              Всего гостей в день за последние 30 дней
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={dailyTrafficConfig} className="h-[300px] w-full">
              <LineChart
                data={data.dailyTraffic}
                margin={{ top: 5, right: 10, left: 10, bottom: 0 }}
              >
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(0, 0%, 25%)" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDateLabel}
                  tick={{ fill: "hsl(0, 0%, 60%)", fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fill: "hsl(0, 0%, 60%)", fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <ChartTooltip
                  cursor={true}
                  content={
                    <ChartTooltipContent
                      labelFormatter={(value) => {
                        const d = new Date(value + "T00:00:00")
                        return d.toLocaleDateString("de-DE", {
                          day: "2-digit",
                          month: "long",
                          year: "numeric",
                        })
                      }}
                    />
                  }
                />
                <Line
                  dataKey="guests"
                  type="monotone"
                  stroke="var(--color-guests)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: "hsl(0, 0%, 100%)", strokeWidth: 0 }}
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Bottom Row: Peak Hours + Party Size */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Peak Hours */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Пиковые часы</CardTitle>
              <CardDescription className="text-gray-400">
                Всего гостей по часам (за последние 90 дней)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={peakHoursConfig} className="h-[300px] w-full">
                <BarChart
                  data={data.peakHours}
                  margin={{ top: 5, right: 10, left: 10, bottom: 0 }}
                >
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(0, 0%, 25%)" />
                  <XAxis
                    dataKey="hour"
                    tickFormatter={formatHourLabel}
                    tick={{ fill: "hsl(0, 0%, 60%)", fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fill: "hsl(0, 0%, 60%)", fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        labelFormatter={(_value, payload) => {
                          const hour = payload?.[0]?.payload?.hour
                          return hour !== undefined ? formatHourLabel(Number(hour)) : String(_value)
                        }}
                      />
                    }
                  />
                  <Bar
                    dataKey="guests"
                    fill="var(--color-guests)"
                    radius={[4, 4, 0, 0]}
                    activeBar={{ fill: "hsl(221, 83%, 53%)" }}
                  />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Party Size Distribution */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Размер групп</CardTitle>
              <CardDescription className="text-gray-400">
                Распределение резерваций по размеру (за 90 дней)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={partySizeConfig} className="h-[300px] w-full">
                <PieChart>
                  <ChartTooltip
                    cursor={true}
                    content={
                      <ChartTooltipContent
                        nameKey="category"
                        hideLabel
                      />
                    }
                  />
                  <Pie
                    data={data.partySizeDistribution}
                    dataKey="count"
                    nameKey="category"
                    innerRadius={60}
                    outerRadius={100}
                    strokeWidth={2}
                    stroke="hsl(0, 0%, 15%)"
                  >
                    {data.partySizeDistribution.map((entry) => (
                      <Cell
                        key={entry.category}
                        fill={partySizeConfig[entry.category as keyof typeof partySizeConfig]?.color ?? "hsl(0, 0%, 50%)"}
                      />
                    ))}
                  </Pie>
                  <ChartLegend content={<ChartLegendContent nameKey="category" className="text-gray-300" />} />
                </PieChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
