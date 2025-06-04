import React, { useRef, useEffect, useState, useCallback } from 'react';

/**
 * Virtual Table Component for rendering large datasets efficiently
 * Only renders visible rows to improve performance
 */
const VirtualTable = ({ 
  columns, 
  data, 
  rowHeight = 48, 
  headerHeight = 48,
  height = 400,
  onRowClick,
  className = ''
}) => {
  const scrollContainerRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeout = useRef(null);

  // Calculate visible range
  const visibleStart = Math.floor(scrollTop / rowHeight);
  const visibleEnd = Math.ceil((scrollTop + height) / rowHeight);
  const visibleRange = visibleEnd - visibleStart;
  
  // Add buffer for smooth scrolling
  const buffer = 5;
  const startIndex = Math.max(0, visibleStart - buffer);
  const endIndex = Math.min(data.length, visibleEnd + buffer);
  
  const visibleData = data.slice(startIndex, endIndex);
  const totalHeight = data.length * rowHeight;
  const offsetY = startIndex * rowHeight;

  const handleScroll = useCallback((e) => {
    const newScrollTop = e.target.scrollTop;
    setScrollTop(newScrollTop);
    setIsScrolling(true);
    
    // Clear existing timeout
    if (scrollTimeout.current) {
      clearTimeout(scrollTimeout.current);
    }
    
    // Set scrolling to false after scroll ends
    scrollTimeout.current = setTimeout(() => {
      setIsScrolling(false);
    }, 150);
  }, []);

  useEffect(() => {
    return () => {
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }
    };
  }, []);

  return (
    <div className={`relative ${className}`}>
      {/* Header */}
      <div 
        className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700"
        style={{ height: headerHeight }}
      >
        <div className="flex">
          {columns.map((column, index) => (
            <div 
              key={column.key || index}
              className={`px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 ${column.className || ''}`}
              style={{ 
                width: column.width || 'auto',
                flex: column.width ? 'none' : 1
              }}
            >
              {column.header}
            </div>
          ))}
        </div>
      </div>

      {/* Scrollable content */}
      <div 
        ref={scrollContainerRef}
        className="overflow-y-auto"
        style={{ height: height - headerHeight }}
        onScroll={handleScroll}
      >
        {/* Total height container */}
        <div style={{ height: totalHeight, position: 'relative' }}>
          {/* Visible rows */}
          <div 
            style={{ 
              transform: `translateY(${offsetY}px)`,
              willChange: isScrolling ? 'transform' : 'auto'
            }}
          >
            {visibleData.map((row, rowIndex) => {
              const actualIndex = startIndex + rowIndex;
              return (
                <div 
                  key={row.id || actualIndex}
                  className={`flex border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                    onRowClick ? 'cursor-pointer' : ''
                  }`}
                  style={{ height: rowHeight }}
                  onClick={() => onRowClick && onRowClick(row, actualIndex)}
                >
                  {columns.map((column, colIndex) => (
                    <div 
                      key={column.key || colIndex}
                      className={`px-4 py-3 flex items-center ${column.className || ''}`}
                      style={{ 
                        width: column.width || 'auto',
                        flex: column.width ? 'none' : 1
                      }}
                    >
                      {column.render ? column.render(row[column.key], row) : row[column.key]}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(VirtualTable);
