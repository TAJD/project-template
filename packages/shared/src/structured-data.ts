export function webSite(opts: { name: string; url: string }): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: opts.name,
    url: opts.url,
  };
}

export function article(opts: {
  headline: string;
  datePublished: string;
  dateModified?: string;
  author: string;
  image?: string;
  url: string;
}): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: opts.headline,
    datePublished: opts.datePublished,
    ...(opts.dateModified ? { dateModified: opts.dateModified } : {}),
    author: { '@type': 'Person', name: opts.author },
    ...(opts.image ? { image: opts.image } : {}),
    url: opts.url,
  };
}

export function faqPage(opts: { questions: { question: string; answer: string }[] }): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: opts.questions.map((q) => ({
      '@type': 'Question',
      name: q.question,
      acceptedAnswer: { '@type': 'Answer', text: q.answer },
    })),
  };
}

export function breadcrumbList(opts: { items: { name: string; url: string }[] }): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: opts.items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}
