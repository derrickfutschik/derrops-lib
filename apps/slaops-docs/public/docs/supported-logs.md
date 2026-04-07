# Supported Logs

SLAOps focuses on logging HTTP requests and responses. There are different levels of support for these types of logs:

| Level         | Name                | Description                                                             |
| ------------- | ------------------- | ----------------------------------------------------------------------- |
| FULL          | Fully Supported     | We have a dedicated connector for this type of log                      |
| PARTIAL       | Partially Supported | We have a connector for this type of log, but it is not fully supported |
| SOON          | Coming Soon         | We are working on a connector for this type of log                      |
| NOT_SUPPORTED | Not Supported       | We do not have a connector for this type of log                         |

Below are the different types of requests currently supported:

| Log Type            | Key   | Level | Description                                                                                                                                        |
| ------------------- | ----- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| SAAS Logs           | SAAS  | FULL  | HTTP calls to your SAAS applications                                                                                                               |
| Agent Logs          | AGENT | SOON  | HTTP calls from your Agents when they access other HTTP calls                                                                                      |
| API Gateway Logs    | API   | SOON  | API Gateway Access Logs from AWS can be transformed                                                                                                |
| Load Balancer Logs  | LB    | SOON  | Access Logs from your Load Balancer                                                                                                                |
| Server Logs         | SERV  | SOON  | Logs at your application level can be added into the platform                                                                                      |
| Web Browser Logs    | WEB   | SOON  | Logs from Javascript or Http Clients can be added and transformed into the platform                                                                |
| Mobile Client Logs  | MOB   | SOON  | SLAOPs Platform can be used on your own Mobile Client Logs. Using the platform you can generate the view of a consumer of your own Mobile Client   |
| Desktop Client Logs | DESK  | SOON  | SLAOPs Platform can be used on your own Desktop Client Logs. Using the platform you can generate the view of a consumer of your own Desktop Client |
