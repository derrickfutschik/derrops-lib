import { Service } from '@/client/slaops-cloud/models/service'
import { Activity, AlertCircle, Clock, TrendingUp } from 'lucide-react'
import ServiceMetricCard from './ServiceMetricCard'

const AVAILABILITY_STATUS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
  excellent: { label: 'Excellent', variant: 'default' },
  good: { label: 'Good', variant: 'secondary' },
  poor: { label: 'Poor', variant: 'destructive' },
  unknown: { label: 'Unknown', variant: 'secondary' },
}

const RESPONSE_TIME_STATUS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
  fast: { label: 'Fast', variant: 'default' },
  normal: { label: 'Normal', variant: 'secondary' },
  slow: { label: 'Slow', variant: 'destructive' },
  unknown: { label: 'Unknown', variant: 'secondary' },
}

const getAvailabilityStatus = (availability: number | null) => {
  if (!availability) return AVAILABILITY_STATUS.unknown
  if (availability >= 99.9) return AVAILABILITY_STATUS.excellent
  if (availability >= 99.0) return AVAILABILITY_STATUS.good
  return AVAILABILITY_STATUS.poor
}

const getResponseTimeStatus = (responseTime: number | null) => {
  if (!responseTime) return RESPONSE_TIME_STATUS.unknown
  if (responseTime < 200) return RESPONSE_TIME_STATUS.fast
  if (responseTime < 500) return RESPONSE_TIME_STATUS.normal
  return RESPONSE_TIME_STATUS.slow
}

interface ServiceMetricsGridProps {
  service: Service
}

const ServiceMetricsGrid = ({ service }: ServiceMetricsGridProps) => {
  const availabilityStatus = getAvailabilityStatus(service.availability)
  const responseTimeStatus = getResponseTimeStatus(service.response_time)

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <ServiceMetricCard
        title="Availability"
        icon={<Activity className="h-4 w-4 text-primary" />}
        value={service.availability ? `${service.availability}%` : 'N/A'}
        badge={availabilityStatus}
      />
      <ServiceMetricCard
        title="Response Time"
        icon={<Clock className="h-4 w-4 text-primary" />}
        value={service.response_time ? `${service.response_time}ms` : 'N/A'}
        badge={responseTimeStatus}
      />
      <ServiceMetricCard
        title="Uptime"
        icon={<TrendingUp className="h-4 w-4 text-primary" />}
        value="99.98%"
        subtitle="Last 30 days"
      />
      <ServiceMetricCard
        title="Error Rate"
        icon={<AlertCircle className="h-4 w-4 text-primary" />}
        value="0.02%"
        subtitle="Last 24 hours"
      />
    </div>
  )
}

export default ServiceMetricsGrid
