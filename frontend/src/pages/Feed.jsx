function Feed() {
  // Hardcoded sample posts for now
  const samplePosts = [
    {
      id: 1,
      title: "Welcome to BearBoard!",
      body: "This is the first post on the Morgan State campus board.",
      category: "General",
      author: "Admin",
      upvotes: 5,
      downvotes: 0,
    },
    {
      id: 2,
      title: "Career Fair this Friday",
      body: "Don't forget the Spring career fair in the Student Center.",
      category: "Events",
      author: "Career Services",
      upvotes: 12,
      downvotes: 1,
    },
    {
      id: 3,
      title: "Study group for COSC 458",
      body: "Looking for study partners for the Software Engineering midterm.",
      category: "Academic",
      author: "Student",
      upvotes: 8,
      downvotes: 0,
    },
  ]

  return (
    <div className="mt-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Campus Feed</h1>
        {/* TODO: Add "New Post" button that opens create post modal */}
      </div>

      {/* TODO: Add sort tabs (Newest, Popular) */}
      {/* TODO: Add category filter chips */}
      {/* TODO: Connect to GET /api/posts instead of hardcoded data */}

      <div className="space-y-4">
        {samplePosts.map((post) => (
          <div key={post.id} className="bg-white rounded shadow p-4">
            <div className="flex justify-between">
              <span className="text-xs bg-gray-200 rounded px-2 py-1">
                {post.category}
              </span>
              <span className="text-xs text-gray-500">by {post.author}</span>
            </div>
            <h3 className="text-lg font-semibold mt-2">{post.title}</h3>
            <p className="text-gray-600 mt-1">{post.body}</p>
            <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
              {/* TODO: Wire up vote buttons to API */}
              <button className="hover:text-green-600">▲ {post.upvotes}</button>
              <button className="hover:text-red-600">▼ {post.downvotes}</button>
              {/* TODO: Add comment count and bookmark button */}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Feed
