import Heading from '@theme/Heading'
import clsx from 'clsx'
import type { ReactNode } from 'react'
import styles from './styles.module.css'

type FeatureItem = {
  title: string
  Svg: React.ComponentType<React.ComponentProps<'svg'>>
  description: ReactNode
}

const FeatureList: FeatureItem[] = [
  {
    title: 'SLA Monitor',
    Svg: require('@site/static/img/undraw_docusaurus_mountain.svg').default,
    description: (
      <>
        <ul>
          <li>Check how the performance of the APIs you are using are performing.</li>
          <li>Detect downtime directly</li>
          <li>Detect usage behavior changes</li>
        </ul>
      </>
    ),
  },
  {
    title: 'Caller Corrector',
    Svg: require('@site/static/img/undraw_docusaurus_tree.svg').default,
    description: (
      <>
        <ul>
          <li>Check the correctness of your calls (validation)</li>
          <li>Check if you will exceed API limits</li>
          <li>Check other 400 issues</li>
        </ul>
      </>
    ),
  },
  {
    title: 'OpenAPIAI',
    Svg: require('@site/static/img/undraw_docusaurus_react.svg').default,
    description: (
      <ul>
        <li>Automatically generate an OpenAPI specification based on API calls</li>
      </ul>
    ),
  },
]

function Feature({ title, Svg, description }: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center">
        <Svg className={styles.featureSvg} role="img" />
      </div>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  )
}

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  )
}
