---
slug: personas
title: Platform Personas
authors: [derrops]
tags: [personas, user-roles]
---

# Platform Personas

This document outlines the key personas who interact with the SLAOps platform, their priorities, and what matters most to them.

## Persona Overview

| Persona | Primary Goals | Key Metrics | Platform Priorities |
|---------|--------------|-------------|---------------------|
| **User** | Access platform dashboards and monitoring data | Dashboard visibility, Data accessibility | Login functionality, Intuitive dashboards, Real-time data visualization |
| **Developer** | Instrument applications with SDK, Track API performance | API usage, Latency, Throughput, Availability, Consistency, Reliability, Security, Compliance, Performance, Scalability | Multi-language SDK support (Node.js, Python, Ruby, Go, Java, C#), Easy integration, Proactive error notifications, Deprecation warnings, Validation error guidance |
| **Software Manager** | Conduct QBRs and oversee team performance | Usage trends, Error rates, Latency, Throughput, Availability, Consistency, Reliability, Security, Compliance, Performance, Scalability | Comprehensive reporting, Historical trend analysis, Executive dashboards, QBR-ready metrics |
| **CFO** | Calculate and forecast API costs, Control spending | Current usage costs, Forecasted costs, Usage trends, Cost patterns, Budget adherence | Cost calculation tools, Usage forecasting, Cost trend analysis, Anomaly detection, Budget alerts, Usage plan enforcement |
| **Business Owner** | Monitor service health and business continuity | Service availability, Usage patterns, Business impact metrics | Real-time service status, Usage notifications, Business impact analysis, Service health alerts, Usage trend monitoring |
| **SRE Engineer** | Ensure system reliability and performance | Vendor API performance, System availability, Error rates, Latency spikes, Incident detection | Vendor API monitoring, Performance testing tools (load/stress), Alerting configuration, AI-powered incident investigation, Real-time performance metrics |

## Detailed Persona Profiles

### User
**Role**: General platform user
**Primary Need**: Access to monitoring dashboards and data

**What They Care About**:
- Simple, secure login process
- Clear, intuitive dashboards
- Easy navigation
- Real-time data visibility

**Platform Features**:
- Authentication and authorization
- Dashboard views
- Data visualization
- User-friendly interface

---

### Developer
**Role**: Software engineer building and maintaining applications
**Primary Need**: Easy instrumentation and proactive issue detection

**What They Care About**:
- SDK availability in their programming language (Node.js, Python, Ruby, Go, Java, C#)
- Simple SDK integration
- Comprehensive tracking capabilities (usage, latency, throughput, availability, consistency, reliability, security, compliance, performance, scalability)
- Proactive notifications about:
  - Incorrect API calls with fix guidance
  - Validation errors with solutions
  - Calls that should work but don't
  - API deprecations affecting their code

**Platform Features**:
- Multi-language SDK support
- Request/response tracking
- Error detection and guidance
- API validation
- Deprecation warnings
- Developer-friendly documentation
- Code examples and integration guides

---

### Software Manager
**Role**: Engineering team leader conducting QBRs and managing team performance
**Primary Need**: Comprehensive metrics for quarterly business reviews

**What They Care About**:
- Usage statistics and trends
- Error rates across services
- Latency measurements
- Throughput analysis
- Availability metrics
- Consistency tracking
- Reliability scores
- Security compliance
- Performance benchmarks
- Scalability insights

**Platform Features**:
- Executive dashboards
- QBR reporting tools
- Historical trend analysis
- Cross-service comparisons
- Team performance metrics
- Custom report generation
- Export capabilities for presentations

---

### CFO
**Role**: Chief Financial Officer managing technology spending
**Primary Need**: Cost visibility, forecasting, and control

**What They Care About**:
- **Cost Calculation**:
  - Current API usage costs
  - Historical cost data
  - Forecasted future costs
  - Usage trends and patterns
  - Cost outliers and anomalies
  - Usage spikes and drops
  - Normal vs. abnormal cost levels

- **Cost Control**:
  - Budget adherence alerts
  - Usage plan enforcement
  - Spending threshold notifications

**Platform Features**:
- Real-time cost tracking
- Cost forecasting models
- Usage pattern analysis
- Budget alert system
- Usage plan management
- Cost anomaly detection
- Financial reporting dashboards
- Cost optimization recommendations

---

### Business Owner
**Role**: Service owner responsible for business continuity
**Primary Need**: Service health monitoring and business impact visibility

**What They Care About**:
- Service availability and uptime
- Usage patterns affecting business
- Immediate notification when:
  - Service usage exceeds plan limits
  - Service has stopped
  - Service has started
  - Service usage increases
  - Service usage decreases
  - Service usage fluctuates
  - Service usage spikes
  - Service usage drops
  - Service usage levels off
  - Service usage normalizes

**Platform Features**:
- Real-time service monitoring
- Usage-based alerting
- Service health dashboards
- Business impact metrics
- Configurable notification rules
- Service status history
- Usage trend visualization

---

### SRE Engineer
**Role**: Site Reliability Engineer ensuring system reliability and performance
**Primary Need**: Proactive monitoring, alerting, and performance testing

**What They Care About**:
- **Vendor API Monitoring**:
  - API response times (slow performance)
  - API capacity (overload detection)
  - API responsiveness
  - API availability (downtime detection)

- **Incident Detection & Investigation**:
  - Configurable AI-powered investigation triggers for:
    - Error rate spikes
    - Latency spikes
    - Throughput spikes
    - Availability drops
    - Consistency issues
    - Reliability degradation
    - Security incidents
    - Compliance violations
    - Performance degradation
    - Scalability problems

- **Performance Testing**:
  - Load testing capabilities
  - Stress testing tools

**Platform Features**:
- Vendor API health monitoring
- Advanced alerting system
- AI-powered incident investigation
- Configurable alert thresholds
- Performance testing suite
- Load and stress testing tools
- Real-time metric dashboards
- Incident root cause analysis
- Integration with incident management tools

---

## Persona Interaction Matrix

| Feature Area | User | Developer | Software Manager | CFO | Business Owner | SRE Engineer |
|-------------|------|-----------|------------------|-----|----------------|--------------|
| **Dashboards** |  |  |  |  |  |  |
| **SDK Integration** | - |  | - | - | - |  |
| **Alerting** |  |  |  |  |  |  |
| **Cost Analysis** | - | - |  |  |  | - |
| **Performance Testing** | - |  |  | - | - |  |
| **Reporting** |  |  |  |  |  |  |
| **AI Investigation** | - |  |  | - |  |  |

**Legend**:
-  = Critical priority
-  = High priority
-  = Medium priority
- \- = Not applicable

---

## Design Implications

### For Product Development
- **Multi-persona dashboards**: Different views for different roles
- **Role-based access control**: Appropriate permissions per persona
- **Configurable alerting**: Each persona needs different alert types
- **Comprehensive SDK support**: Essential for developer adoption
- **Financial tools**: Cost tracking and forecasting for CFO needs
- **AI-powered insights**: Automated investigation for SRE and developer efficiency

### For Documentation
- Persona-specific guides and tutorials
- Role-based getting started flows
- Use case examples for each persona
- Integration guides for developers
- Financial reporting guides for CFOs
- Runbook examples for SRE engineers

### For Feature Prioritization
1. **Phase 1**: User authentication, Developer SDKs, Basic dashboards
2. **Phase 2**: SRE alerting, Business Owner notifications, Cost tracking
3. **Phase 3**: AI investigation, Advanced reporting, Performance testing
4. **Phase 4**: Cost forecasting, Advanced analytics, Custom integrations

---

**Related Documents**:
- [User Stories](user-stories.md)
- [Configuration Guide](configuration.md)
- [Client Controller](client-controller.md)
